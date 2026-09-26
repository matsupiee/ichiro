import type { Database } from "@ichiro/db";
import { commitment, paymentCustomer, paymentMethod, penalty } from "@ichiro/db/schema/index";
import { and, eq, lt, or } from "drizzle-orm";

import type { StripeClient } from "../../third-party-lib/stripe";
import { chargePenalty, type ChargeResult } from "../payment/charge-penalty";

// 引き落としに失敗したとき、この回数までは次の cron で試し直す
export const MAX_CHARGE_ATTEMPTS = 3;

// pending（と、回数が残っている failed）の罰金を、登録された支払い方法で引き落とす。
// Stripe 側で処理中になったもの（processing）は、Webhook で結果を反映する
export async function collectPenalties(db: Database, stripe: StripeClient, now: Date = new Date()) {
  const due = await db
    .select({
      penalty,
      goal: commitment.goal,
      stripePaymentMethodId: paymentMethod.stripePaymentMethodId,
      stripeCustomerId: paymentCustomer.stripeCustomerId,
    })
    .from(penalty)
    .innerJoin(commitment, eq(commitment.id, penalty.commitmentId))
    .leftJoin(paymentMethod, eq(paymentMethod.id, penalty.paymentMethodId))
    .leftJoin(paymentCustomer, eq(paymentCustomer.userId, penalty.userId))
    .where(
      or(
        eq(penalty.status, "pending"),
        and(eq(penalty.status, "failed"), lt(penalty.attempts, MAX_CHARGE_ATTEMPTS)),
      ),
    );

  const counts = { paid: 0, processing: 0, failed: 0 };
  for (const { penalty: p, goal, stripePaymentMethodId, stripeCustomerId } of due) {
    const attempts = p.attempts + 1;
    const result: ChargeResult =
      !stripePaymentMethodId || !stripeCustomerId
        ? { status: "failed", reference: null, message: "支払い方法が登録されていません" }
        : await chargePenalty(stripe, {
            // 失敗した決済を試し直せるよう、試行ごとにキーを変える
            idempotencyKey: `penalty:${p.id}:${attempts}`,
            penaltyId: p.id,
            stripeCustomerId,
            stripePaymentMethodId,
            amount: p.amount,
            description: `ichiro 罰金「${goal}」${p.dueDate}`,
          });

    switch (result.status) {
      case "succeeded":
        counts.paid++;
        await db
          .update(penalty)
          .set({
            status: "paid",
            attempts,
            chargeReference: result.reference,
            failureMessage: null,
            paidAt: now,
          })
          .where(eq(penalty.id, p.id));
        break;
      case "processing":
        counts.processing++;
        await db
          .update(penalty)
          .set({ status: "processing", attempts, chargeReference: result.reference })
          .where(eq(penalty.id, p.id));
        break;
      case "failed":
        counts.failed++;
        await db
          .update(penalty)
          .set({
            status: "failed",
            attempts,
            chargeReference: result.reference,
            failureMessage: result.message,
          })
          .where(eq(penalty.id, p.id));
        break;
    }
  }
  return counts;
}

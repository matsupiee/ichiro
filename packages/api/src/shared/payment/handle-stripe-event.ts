import type { Database } from "@ichiro/db";
import { paymentCustomer, penalty } from "@ichiro/db/schema/index";
import { and, eq, isNull, ne } from "drizzle-orm";
import type Stripe from "stripe";

import type { StripeClient } from "../../third-party-lib/stripe";
import { cardErrorMessage } from "./card-error-message";
import { savePaymentMethod } from "./save-payment-method";
import { isAuthenticationRequired } from "./is-authentication-required";

// Stripe の Webhook。引き落としの結果と、支払い方法の登録を反映する
export async function handleStripeEvent(db: Database, stripe: StripeClient, event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const penaltyId = intent.metadata.penalty_id;
      if (!penaltyId) return;
      await db
        .update(penalty)
        .set({
          status: "paid",
          chargeReference: intent.id,
          failureMessage: null,
          paidAt: new Date(event.created * 1000),
        })
        .where(eq(penalty.id, penaltyId));
      return;
    }
    case "payment_intent.requires_action":
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const penaltyId = intent.metadata.penalty_id;
      if (!penaltyId) return;
      const error = intent.last_payment_error;
      const stopRetrying =
        event.type === "payment_intent.requires_action" ||
        isAuthenticationRequired(error, intent.status);
      await db
        .update(penalty)
        .set({
          status: "failed",
          chargeReference: intent.id,
          failureMessage: cardErrorMessage(
            stopRetrying ? "authentication_required" : error?.code,
            error?.message ?? "決済に失敗しました",
          ),
          ...(stopRetrying ? { retryStoppedAt: new Date(event.created * 1000) } : {}),
        })
        // 先に成功が届いていたら上書きしない
        .where(
          and(
            eq(penalty.id, penaltyId),
            ne(penalty.status, "paid"),
            isNull(penalty.retryStoppedAt),
          ),
        );
      return;
    }
    case "setup_intent.succeeded": {
      // アプリからの登録完了の通知が届かなかったときのため、Webhook でも保存する
      const setupIntent = event.data.object;
      const customerId =
        typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id;
      const pmId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;
      if (!customerId || !pmId) return;
      const [customer] = await db
        .select()
        .from(paymentCustomer)
        .where(eq(paymentCustomer.stripeCustomerId, customerId));
      if (!customer) return;
      await savePaymentMethod(db, customer.userId, await stripe.paymentMethods.retrieve(pmId));
      return;
    }
    default:
      return;
  }
}

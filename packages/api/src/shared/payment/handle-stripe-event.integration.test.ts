import { describe, expect, test } from "bun:test";
import { paymentMethod, penalty } from "@ichiro/db/schema/index";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { createFakeStripe } from "../../test/fake-stripe";
import { callerFor, createUser, setupDemo } from "../../test/helpers";
import { addDays } from "../date/add-days";
import { runPenaltyJob } from "../penalty/run-penalty-job";
import { handleStripeEvent } from "./handle-stripe-event";

const event = (type: string, object: object) =>
  ({ type, created: 1_790_000_000, data: { object } }) as unknown as Stripe.Event;

async function processingPenalty() {
  const demo = await setupDemo();
  demo.stripe.willCharge("processing");
  await runPenaltyJob(demo.db, demo.stripe.client, new Date(`${addDays(demo.today, 1)}T00:30:00Z`));
  const [row] = await demo.db
    .select()
    .from(penalty)
    .where(
      and(eq(penalty.commitmentId, demo.seeded.commitmentIds[0]!), eq(penalty.dueDate, demo.today)),
    );
  return { ...demo, row: row! };
}

describe("Stripe の Webhook で結果を反映する", () => {
  test("処理中だった引き落としが成功したら、徴収ずみにする", async () => {
    const { db, stripe, row } = await processingPenalty();
    expect(row.status).toBe("processing");

    await handleStripeEvent(
      db,
      stripe.client,
      event("payment_intent.succeeded", {
        id: row.chargeReference,
        metadata: { penalty_id: row.id },
      }),
    );
    const [after] = await db.select().from(penalty).where(eq(penalty.id, row.id));
    expect(after).toMatchObject({ status: "paid", paidAt: new Date(1_790_000_000_000) });
  });

  test("失敗したら理由を残す。先に成功が届いていたら上書きしない", async () => {
    const { db, stripe, row } = await processingPenalty();
    const failed = event("payment_intent.payment_failed", {
      id: row.chargeReference,
      metadata: { penalty_id: row.id },
      last_payment_error: { code: "card_declined", message: "Your card was declined." },
    });

    await handleStripeEvent(db, stripe.client, failed);
    let [after] = await db.select().from(penalty).where(eq(penalty.id, row.id));
    expect(after).toMatchObject({ status: "failed", failureMessage: "カードが拒否されました" });

    await handleStripeEvent(
      db,
      stripe.client,
      event("payment_intent.succeeded", {
        id: row.chargeReference,
        metadata: { penalty_id: row.id },
      }),
    );
    await handleStripeEvent(db, stripe.client, failed);
    [after] = await db.select().from(penalty).where(eq(penalty.id, row.id));
    expect(after!.status).toBe("paid");
  });

  test("アプリから登録完了が届かなくても、Webhook で支払い方法を保存する", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const session = await createUser(db, "new@example.com");
    const caller = callerFor(db, session, { stripe });
    const setup = await caller.consumer.payment.startSetup();
    const setupIntentId = setup.setupIntentClientSecret.split("_secret_")[0]!;
    const pmId = stripe.completeSetup(setupIntentId, { brand: "visa", last4: "1881" });

    await handleStripeEvent(
      db,
      stripe.client,
      event("setup_intent.succeeded", {
        id: setupIntentId,
        customer: setup.customerId,
        payment_method: pmId,
      }),
    );
    const rows = await db
      .select()
      .from(paymentMethod)
      .where(eq(paymentMethod.userId, session.user.id));
    expect(rows).toEqual([expect.objectContaining({ stripePaymentMethodId: pmId, last4: "1881" })]);
  });
});

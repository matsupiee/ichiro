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

  test.each([
    ["payment_intent.requires_action", undefined],
    ["payment_intent.payment_failed", { code: "authentication_required" }],
    [
      "payment_intent.payment_failed",
      { code: "card_declined", decline_code: "authentication_required" },
    ],
  ] as const)(
    "%s の追加認証通知で再請求を停止し、重複・遅延失敗通知でも解除しない",
    async (type, error) => {
      const { db, stripe, row, today } = await processingPenalty();
      const stopped = event(type, {
        id: row.chargeReference,
        metadata: { penalty_id: row.id },
        last_payment_error: error,
      });
      await handleStripeEvent(db, stripe.client, stopped);
      await handleStripeEvent(db, stripe.client, stopped);
      await handleStripeEvent(
        db,
        stripe.client,
        event("payment_intent.payment_failed", {
          id: row.chargeReference,
          metadata: { penalty_id: row.id },
          last_payment_error: { code: "card_declined" },
        }),
      );
      const [after] = await db.select().from(penalty).where(eq(penalty.id, row.id));
      expect(after).toMatchObject({
        status: "failed",
        attempts: 1,
        retryStoppedAt: new Date(1_790_000_000_000),
      });
      expect(after!.failureMessage).toContain("自動請求を停止");
      const count = stripe.charges.length;
      await runPenaltyJob(db, stripe.client, new Date(`${addDays(today, 1)}T00:30:00Z`));
      expect(stripe.charges.length).toBe(count);
      // 実際に決済済みになった場合は成功を正とし、その後の認証通知で失敗へ戻さない。
      await handleStripeEvent(
        db,
        stripe.client,
        event("payment_intent.succeeded", {
          id: row.chargeReference,
          metadata: { penalty_id: row.id },
        }),
      );
      await handleStripeEvent(db, stripe.client, stopped);
      const [paid] = await db.select().from(penalty).where(eq(penalty.id, row.id));
      expect(paid!.status).toBe("paid");
    },
  );

  test("Stripe の同期応答より先に追加認証の通知が届いても、請求停止を上書きしない", async () => {
    const { db, stripe, today } = await setupDemo();
    stripe.willCharge("processing");
    const create = stripe.client.paymentIntents.create;
    stripe.client.paymentIntents.create = (async (params, options) => {
      const intent = await create(params, options);
      await handleStripeEvent(
        db,
        stripe.client,
        event("payment_intent.requires_action", {
          id: intent.id,
          metadata: params!.metadata,
          status: "requires_action",
        }),
      );
      return intent;
    }) as typeof create;
    const now = new Date(`${addDays(today, 1)}T00:30:00Z`);
    await runPenaltyJob(db, stripe.client, now);
    const rows = await db.select().from(penalty).where(eq(penalty.dueDate, today));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.status).toBe("failed");
      expect(row.retryStoppedAt).not.toBeNull();
    }
    const count = stripe.charges.length;
    await runPenaltyJob(db, stripe.client, now);
    expect(stripe.charges.length).toBe(count);
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

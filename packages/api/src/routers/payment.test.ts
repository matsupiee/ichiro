import { describe, expect, test } from "bun:test";
import { paymentMethod, penalty } from "@ichiro/db/schema/index";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { runPenaltyJob } from "../lib/penalty";
import { addDays } from "../lib/schedule";
import { handleStripeEvent, stripeGateway } from "../lib/stripe";
import { createFakeStripe } from "../test/fake-stripe";
import { callerFor, createUser, setupDemo } from "../test/helpers";

describe("支払い方法を Stripe に登録できる", () => {
  test("登録ずみの支払い方法を、自分の分だけ返す", async () => {
    const { db, caller } = await setupDemo();
    expect(await caller.payment.methods()).toEqual([
      expect.objectContaining({ brand: "visa", last4: "4242", wallet: "apple_pay" }),
      expect.objectContaining({ brand: "mastercard", last4: "4444", wallet: null }),
    ]);

    const other = callerFor(db, await createUser(db, "other@example.com"));
    expect(await other.payment.methods()).toEqual([]);
  });

  test("PaymentSheet で登録すると、カードの種類と下4桁が保存される", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    const setup = await caller.payment.startSetup();
    expect(setup.customerId).toStartWith("cus_");
    expect(setup.ephemeralKeySecret).toStartWith("ek_test");
    expect(setup.setupIntentClientSecret).toMatch(/^seti_.+_secret_/);

    // ユーザーが PaymentSheet で Apple Pay を選んで登録し終えた
    const setupIntentId = setup.setupIntentClientSecret.split("_secret_")[0]!;
    stripe.completeSetup(setupIntentId, { brand: "jcb", last4: "0000", wallet: "apple_pay" });

    const saved = await caller.payment.completeSetup({
      setupIntentClientSecret: setup.setupIntentClientSecret,
    });
    expect(saved).toMatchObject({ brand: "jcb", last4: "0000", wallet: "apple_pay" });
    expect(await caller.payment.methods()).toEqual([saved]);

    // 同じ登録を2回知らせても1件のまま
    await caller.payment.completeSetup({ setupIntentClientSecret: setup.setupIntentClientSecret });
    expect(await caller.payment.methods()).toHaveLength(1);
  });

  test("Stripe の Customer はユーザーごとに1つだけ作る", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    const first = await caller.payment.startSetup();
    const second = await caller.payment.startSetup();
    expect(second.customerId).toBe(first.customerId);
    expect(stripe.customerCount()).toBe(1);
    expect(stripe.setupIntentCount()).toBe(2);
  });

  test("登録が終わっていない SetupIntent や、ほかのユーザーの SetupIntent では保存しない", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const alice = callerFor(db, await createUser(db, "alice@example.com"), { stripe });
    const bob = callerFor(db, await createUser(db, "bob@example.com"), { stripe });

    const setup = await alice.payment.startSetup();
    await expect(
      alice.payment.completeSetup({ setupIntentClientSecret: setup.setupIntentClientSecret }),
    ).rejects.toThrow("支払い方法の登録が終わっていません");

    stripe.completeSetup(setup.setupIntentClientSecret.split("_secret_")[0]!, {
      brand: "visa",
      last4: "4242",
    });
    await bob.payment.startSetup();
    await expect(
      bob.payment.completeSetup({ setupIntentClientSecret: setup.setupIntentClientSecret }),
    ).rejects.toThrow("支払い方法の登録が見つかりません");
    expect(await bob.payment.methods()).toEqual([]);
  });

  test("ログインしていないと登録できない", async () => {
    const { db } = await setupDemo();
    await expect(callerFor(db, null).payment.startSetup()).rejects.toThrow(
      "Authentication required",
    );
  });
});

describe("Stripe の Webhook で結果を反映する", () => {
  const event = (type: string, object: object) =>
    ({ type, created: 1_790_000_000, data: { object } }) as unknown as Stripe.Event;

  async function processingPenalty() {
    const demo = await setupDemo();
    demo.stripe.willCharge("processing");
    await runPenaltyJob(
      demo.db,
      stripeGateway(demo.stripe.client),
      new Date(`${addDays(demo.today, 1)}T00:30:00Z`),
    );
    const [row] = await demo.db
      .select()
      .from(penalty)
      .where(
        and(
          eq(penalty.commitmentId, demo.seeded.commitmentIds[0]!),
          eq(penalty.dueDate, demo.today),
        ),
      );
    return { ...demo, row: row! };
  }

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
    const setup = await caller.payment.startSetup();
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

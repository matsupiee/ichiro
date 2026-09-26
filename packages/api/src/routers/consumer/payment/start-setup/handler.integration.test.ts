import { describe, expect, test } from "bun:test";

import { createFakeStripe } from "../../../../test/fake-stripe";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("PaymentSheet を開くための情報を作れる", () => {
  test("Customer・一時キー・SetupIntent を返す", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    const setup = await caller.consumer.payment.startSetup();
    expect(setup.customerId).toStartWith("cus_");
    expect(setup.ephemeralKeySecret).toStartWith("ek_test");
    expect(setup.setupIntentClientSecret).toMatch(/^seti_.+_secret_/);
  });

  test("Stripe の Customer はユーザーごとに1つだけ作る", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    const first = await caller.consumer.payment.startSetup();
    const second = await caller.consumer.payment.startSetup();
    expect(second.customerId).toBe(first.customerId);
    expect(stripe.customerCount()).toBe(1);
    expect(stripe.setupIntentCount()).toBe(2);
  });

  test("ログインしていないと登録できない", async () => {
    const { db } = await setupDemo();
    await expect(callerFor(db, null).consumer.payment.startSetup()).rejects.toThrow(
      "Authentication required",
    );
  });
});

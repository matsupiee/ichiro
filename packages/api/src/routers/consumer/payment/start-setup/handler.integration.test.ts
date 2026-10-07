import { describe, expect, test } from "bun:test";

import { createFakeStripe } from "../../../../test/fake-stripe";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("Payment Element を開くための情報を作れる", () => {
  test("SetupIntent の client secret を返す", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    const setup = await caller.consumer.payment.startSetup();
    expect(setup.setupIntentClientSecret).toMatch(/^seti_.+_secret_/);
  });

  test("Stripe の Customer はユーザーごとに1つだけ作る", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    await caller.consumer.payment.startSetup();
    await caller.consumer.payment.startSetup();
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

import { describe, expect, test } from "bun:test";

import { createFakeStripe } from "../../../../test/fake-stripe";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("PaymentSheet で登録した支払い方法を保存できる", () => {
  test("登録すると、カードの種類と下4桁が保存される", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const caller = callerFor(db, await createUser(db, "new@example.com"), { stripe });

    const setup = await caller.consumer.payment.startSetup();
    // Stripe がウォレット（Apple Pay など）経由と返した支払い方法は、ウォレットとして保存する
    const setupIntentId = setup.setupIntentClientSecret.split("_secret_")[0]!;
    stripe.completeSetup(setupIntentId, { brand: "jcb", last4: "0000", wallet: "apple_pay" });

    const saved = await caller.consumer.payment.completeSetup({
      setupIntentClientSecret: setup.setupIntentClientSecret,
    });
    expect(saved).toMatchObject({ brand: "jcb", last4: "0000", wallet: "apple_pay" });
    expect(await caller.consumer.payment.listMethods()).toEqual([saved]);

    // 同じ登録を2回知らせても1件のまま
    await caller.consumer.payment.completeSetup({
      setupIntentClientSecret: setup.setupIntentClientSecret,
    });
    expect(await caller.consumer.payment.listMethods()).toHaveLength(1);
  });

  test("登録が終わっていない SetupIntent や、ほかのユーザーの SetupIntent では保存しない", async () => {
    const { db } = await setupDemo();
    const stripe = createFakeStripe();
    const alice = callerFor(db, await createUser(db, "alice@example.com"), { stripe });
    const bob = callerFor(db, await createUser(db, "bob@example.com"), { stripe });

    const setup = await alice.consumer.payment.startSetup();
    await expect(
      alice.consumer.payment.completeSetup({
        setupIntentClientSecret: setup.setupIntentClientSecret,
      }),
    ).rejects.toThrow("支払い方法の登録が終わっていません");

    stripe.completeSetup(setup.setupIntentClientSecret.split("_secret_")[0]!, {
      brand: "visa",
      last4: "4242",
    });
    await bob.consumer.payment.startSetup();
    await expect(
      bob.consumer.payment.completeSetup({
        setupIntentClientSecret: setup.setupIntentClientSecret,
      }),
    ).rejects.toThrow("支払い方法の登録が見つかりません");
    expect(await bob.consumer.payment.listMethods()).toEqual([]);
  });

  test("Stripe にない SetupIntent では保存しない", async () => {
    const { caller } = await setupDemo();
    await expect(
      caller.consumer.payment.completeSetup({ setupIntentClientSecret: "seti_missing_secret_x" }),
    ).rejects.toThrow("支払い方法の登録が見つかりません");
  });
});

import { describe, expect, test } from "bun:test";

import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("登録ずみの支払い方法を一覧できる", () => {
  test("自分の支払い方法だけを、登録した順に返す", async () => {
    const { db, caller } = await setupDemo();
    expect(await caller.consumer.payment.listMethods()).toEqual([
      expect.objectContaining({ brand: "visa", last4: "4242", wallet: null }),
      expect.objectContaining({ brand: "mastercard", last4: "4444", wallet: null }),
    ]);

    const other = callerFor(db, await createUser(db, "other@example.com"));
    expect(await other.consumer.payment.listMethods()).toEqual([]);
  });

  test("Stripe の ID は返さない", async () => {
    const { caller } = await setupDemo();
    const [method] = await caller.consumer.payment.listMethods();
    expect(Object.keys(method!).sort()).toEqual(["brand", "id", "last4", "wallet"]);
  });

  test("ログインしていないと一覧できない", async () => {
    const { db } = await setupDemo();
    await expect(callerFor(db, null).consumer.payment.listMethods()).rejects.toThrow(
      "Authentication required",
    );
  });
});

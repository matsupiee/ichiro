import { expect, test } from "bun:test";
import { account, commitment, paymentCustomer, user } from "@ichiro/db/schema/index";
import { seedWithdrawal, WITHDRAWAL_USER } from "@ichiro/db/seed/withdrawal";
import { callerFor, createTestDb, sessionFor } from "./helpers";

test("退会seedは専用ユーザーと罰金なしの記録を作り、退会済みユーザーを上書きしない", async () => {
  const db = await createTestDb();
  await seedWithdrawal(db);
  expect(await db.select().from(account)).toHaveLength(1);
  expect(await db.select().from(paymentCustomer)).toHaveLength(0);
  expect(await db.select().from(commitment)).toMatchObject([{ penaltyAmount: null }]);
  await callerFor(db, await sessionFor(db, WITHDRAWAL_USER.email)).consumer.account.withdraw({
    acknowledged: true,
  });
  const before = await db.select().from(user);
  await expect(seedWithdrawal(db)).rejects.toThrow("既に存在");
  expect(await db.select().from(user)).toEqual(before);
  await seedWithdrawal(db, "withdrawal-2@ichiro.example");
  expect(await db.select().from(user)).toHaveLength(2);
});

import { expect, test } from "bun:test";
import { paymentCustomer, penalty } from "@ichiro/db/schema/index";
import { seedPaymentAuthentication } from "@ichiro/db/seed/payment-authentication";
import { collectPenalties } from "../shared/penalty/collect-penalties";
import { createFakeStripe } from "./fake-stripe";
import { createTestDb } from "./helpers";

test("追加認証 seed は請求停止履歴を作り、実決済用の顧客を持たず、上書きしない", async () => {
  const db = await createTestDb();
  await seedPaymentAuthentication(db);
  expect(await db.select().from(paymentCustomer)).toHaveLength(0);
  const [row] = await db.select().from(penalty);
  expect(row!.retryStoppedAt).toBeInstanceOf(Date);
  const stripe = createFakeStripe();
  await collectPenalties(db, stripe.client);
  expect(stripe.charges).toHaveLength(0);
  await expect(seedPaymentAuthentication(db)).rejects.toThrow("既に存在");
  expect(await db.select().from(penalty)).toHaveLength(1);
});

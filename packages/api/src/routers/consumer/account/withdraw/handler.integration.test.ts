import { expect, test } from "bun:test";
import {
  account,
  commitment,
  commitmentLog,
  paymentCustomer,
  paymentMethod,
  penalty,
  report,
  session as sessionTable,
  user,
} from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";
import { runPenaltyJob } from "../../../../shared/penalty/run-penalty-job";
import { collectPenalties } from "../../../../shared/penalty/collect-penalties";
import { withActiveUser } from "../../../../shared/account/with-active-user";
import { handleStripeEvent } from "../../../../shared/payment/handle-stripe-event";
import type Stripe from "stripe";

async function records(db: Awaited<ReturnType<typeof setupDemo>>["db"]) {
  return Promise.all([
    db.select().from(account),
    db.select().from(commitment),
    db.select().from(commitmentLog),
    db.select().from(paymentCustomer),
    db.select().from(paymentMethod),
    db.select().from(penalty),
    db.select().from(report),
  ]);
}

test("確認を必須とし、自分だけ退会する。記録と支払い情報は保持し、全セッションを失効する", async () => {
  const t = await setupDemo();
  const other = await createUser(t.db, "other@example.com");
  const before = await records(t.db);
  for (const id of ["one", "two"])
    await t.db.insert(sessionTable).values({ ...t.session.session, id, token: id });
  await expect(
    callerFor(t.db, null).consumer.account.withdraw({ acknowledged: true }),
  ).rejects.toThrow();
  await expect(
    t.caller.consumer.account.withdraw({ acknowledged: false as true }),
  ).rejects.toThrow();
  expect(await t.caller.consumer.account.withdraw({ acknowledged: true })).toEqual({
    status: "completed",
  });
  expect(await records(t.db)).toEqual(before);
  expect(await t.db.select().from(sessionTable)).toHaveLength(0);
  const [stored] = await t.db.select().from(user).where(eq(user.id, t.session.user.id));
  expect(stored).toMatchObject({
    name: t.session.user.name,
    email: t.session.user.email,
    image: t.session.user.image,
  });
  expect(stored!.withdrawnAt).toBeInstanceOf(Date);
  await expect(t.caller.consumer.commitment.list({ today: t.today })).rejects.toThrow("退会済み");
  expect(await callerFor(t.db, other).consumer.commitment.list({ today: t.today })).toBeDefined();
  expect(await t.caller.consumer.account.withdraw({ acknowledged: true })).toEqual({
    status: "completed",
  });
});

test("退会後は未精算・pending・failed を残したまま、生成も請求も再試行もしない", async () => {
  const t = await setupDemo();
  await t.db.update(penalty).set({ status: "failed", attempts: 1 });
  await t.caller.consumer.account.withdraw({ acknowledged: true });
  const before = await records(t.db);
  const result = await runPenaltyJob(t.db, t.stripe.client, new Date(Date.now() + 7 * 86400000));
  expect(result).toEqual({ created: 0, paid: 0, processing: 0, failed: 0 });
  expect(t.stripe.charges).toHaveLength(0);
  expect(await records(t.db)).toEqual(before);
});

test("進行中の操作があっても即時退会し、新しい操作を拒否する", async () => {
  const t = await setupDemo();
  await withActiveUser(t.db, t.session.user.id, async () => {
    expect(await t.caller.consumer.account.withdraw({ acknowledged: true })).toEqual({
      status: "completed",
    });
    await expect(t.caller.consumer.payment.startSetup()).rejects.toThrow();
  });
  const [stored] = await t.db.select().from(user).where(eq(user.id, t.session.user.id));
  expect(stored!.withdrawnAt).toBeInstanceOf(Date);
});

test("開始済みの決済を待たずに退会し、その結果は保存するが次の請求は行わない", async () => {
  const t = await setupDemo();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const create = t.stripe.client.paymentIntents.create;
  await t.db.update(penalty).set({ status: "pending", attempts: 0 });
  t.stripe.client.paymentIntents.create = (async (...args: Parameters<typeof create>) => {
    started.resolve();
    await release.promise;
    return create(...args);
  }) as typeof create;
  const collecting = collectPenalties(t.db, t.stripe.client);
  await started.promise;
  try {
    expect(await t.caller.consumer.account.withdraw({ acknowledged: true })).toEqual({
      status: "completed",
    });
    await expect(t.caller.consumer.payment.startSetup()).rejects.toThrow("退会済み");
  } finally {
    release.resolve();
  }
  await collecting;
  await runPenaltyJob(t.db, t.stripe.client);
  expect(t.stripe.charges).toHaveLength(1);
  const id = String(t.stripe.charges[0]!.params.metadata!.penalty_id);
  const [charged] = await t.db.select().from(penalty).where(eq(penalty.id, id));
  expect(charged!.status).toBe("paid");
});

test("遅延した失敗Webhookが届いても退会済みユーザーへ再請求しない", async () => {
  const t = await setupDemo();
  const [p] = await t.db.select().from(penalty);
  await t.caller.consumer.account.withdraw({ acknowledged: true });
  await handleStripeEvent(t.db, t.stripe.client, {
    id: "evt_late",
    object: "event",
    api_version: null,
    created: 1790000000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: "pi_late",
        metadata: { penalty_id: p!.id },
        last_payment_error: null,
      } as unknown as Stripe.PaymentIntent,
    },
  } satisfies Stripe.Event);
  await runPenaltyJob(t.db, t.stripe.client);
  expect(t.stripe.charges).toHaveLength(0);
});

test("Stripeが通信障害でも退会は完了し、未確認の決済を再請求しない", async () => {
  const t = await setupDemo();
  await t.db.update(penalty).set({ status: "pending", attempts: 0 });
  let calls = 0;
  t.stripe.client.paymentIntents.create = async () => {
    calls++;
    throw new Error("timeout");
  };
  await collectPenalties(t.db, t.stripe.client);
  const before = calls;
  expect(before).toBeGreaterThan(0);
  expect(await t.caller.consumer.account.withdraw({ acknowledged: true })).toEqual({
    status: "completed",
  });
  await runPenaltyJob(t.db, t.stripe.client);
  expect(calls).toBe(before);
});

test("退会開始後はログイン検証と競合したセッションのINSERTも拒否する", async () => {
  const t = await setupDemo();
  await t.db.insert(sessionTable).values(t.session.session);
  await t.caller.consumer.account.withdraw({ acknowledged: true });
  await expect(t.db.insert(sessionTable).values(t.session.session).execute()).rejects.toThrow();
  expect(await t.db.select().from(sessionTable)).toHaveLength(0);
});

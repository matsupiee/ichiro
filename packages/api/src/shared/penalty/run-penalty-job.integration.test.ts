import { describe, expect, test } from "bun:test";
import { commitment, penalty } from "@ichiro/db/schema/index";
import { and, eq } from "drizzle-orm";

import { setupDemo } from "../../test/helpers";
import { addDays } from "../date/add-days";
import { runPenaltyJob } from "./run-penalty-job";

type Demo = Awaited<ReturnType<typeof setupDemo>>;

// デモデータは UTC で作るので、翌日の 0:30（UTC）には今日の締め切りが過ぎている
const tomorrow = (today: string) => new Date(`${addDays(today, 1)}T00:30:00Z`);
const runJob = ({ db, stripe }: Demo, now?: Date) => runPenaltyJob(db, stripe.client, now);
const penaltyOn = async ({ db }: Demo, commitmentId: string, dueDate: string) => {
  const [row] = await db
    .select()
    .from(penalty)
    .where(and(eq(penalty.commitmentId, commitmentId), eq(penalty.dueDate, dueDate)));
  return row!;
};

const values = {
  goal: "読書",
  content: "毎日10ページ読む",
  frequency: "daily" as const,
  weekdays: [],
  monthDays: [],
  untilDate: "2099-12-31",
  penaltyAmount: null,
  paymentMethodId: null,
};

describe("報告できなかった日は罰金が徴収される", () => {
  test("締め切りを過ぎると、未報告の日の罰金を Stripe で引き落とし、詳細の履歴に出る", async () => {
    const demo = await setupDemo();
    const { caller, today, seeded, stripe } = demo;
    const cantonese = seeded.commitmentIds[0]!;

    const result = await runJob(demo, tomorrow(today));
    expect(result).toMatchObject({ failed: 0, processing: 0 });
    expect(result.paid).toBe(result.created);

    const after = await caller.consumer.commitment.get({ id: cantonese, today });
    expect(after.penalties[0]).toMatchObject({ dueDate: today, amount: 500, status: "paid" });
    expect(after.penaltyTotal).toBe(1500);

    // 保存した支払い方法で、ユーザーがいないときの決済として引き落とす
    const row = await penaltyOn(demo, cantonese, today);
    const charge = stripe.charges.find((c) => c.params.metadata?.penalty_id === row.id)!;
    expect(charge.params).toMatchObject({
      amount: 500,
      currency: "jpy",
      customer: `cus_demo_${seeded.userId}`,
      payment_method: `pm_demo_apple_pay_${seeded.userId}`,
      off_session: true,
      confirm: true,
    });
    expect(charge.idempotencyKey).toBe(`penalty:${row.id}:1`);
    expect(row.chargeReference).toStartWith("pi_");

    // 今日も報告ずみの「禁煙」には罰金がかからない
    const smoking = await caller.consumer.commitment.get({ id: seeded.commitmentIds[2]!, today });
    expect(smoking.penalties).toEqual([]);
  });

  test("締め切り前に報告すれば罰金はかからない", async () => {
    const demo = await setupDemo();
    const { caller, today, seeded } = demo;
    const id = seeded.commitmentIds[0]!;
    await caller.consumer.commitment.report({ id, today });

    await runJob(demo, tomorrow(today));
    const detail = await caller.consumer.commitment.get({ id, today });
    expect(detail.penalties.map((p) => p.dueDate)).not.toContain(today);
  });

  test("同じ日の罰金を二重に徴収しない", async () => {
    const demo = await setupDemo();
    const first = await runJob(demo, tomorrow(demo.today));
    expect(first.created).toBeGreaterThan(0);
    const charges = demo.stripe.charges.length;

    const second = await runJob(demo, tomorrow(demo.today));
    expect(second).toEqual({ created: 0, paid: 0, processing: 0, failed: 0 });
    expect(demo.stripe.charges.length).toBe(charges);
  });

  test("罰金を設定していないコミットメントでは徴収しない", async () => {
    const demo = await setupDemo();
    const { caller, today } = demo;
    const created = await caller.consumer.commitment.create({ today, timeZone: "UTC", values });

    await runJob(demo, new Date(`${addDays(today, 3)}T00:30:00Z`));
    const detail = await caller.consumer.commitment.get({ id: created.id, today });
    expect(detail.penalties).toEqual([]);
  });

  test("この機能より前に作られたコミットメントは、過去の分をさかのぼらない", async () => {
    const demo = await setupDemo();
    const { db, caller, today, seeded } = demo;
    const id = seeded.commitmentIds[0]!;
    await db.delete(penalty).where(eq(penalty.commitmentId, id));
    await db.update(commitment).set({ settledThrough: null }).where(eq(commitment.id, id));

    const result = await runJob(demo);
    const detail = await caller.consumer.commitment.get({ id, today });
    expect(detail.penalties).toEqual([]);
    expect(detail.settledThrough).toBe(addDays(today, -1));
    expect(result.created).toBe(0);
  });

  test("カードが拒否されたら、試行ごとに冪等キーを変えて3回まで試し直す", async () => {
    const demo = await setupDemo();
    const { caller, today, seeded, stripe } = demo;
    const cantonese = seeded.commitmentIds[0]!;
    stripe.willCharge("card_declined");

    for (let i = 0; i < 4; i++) await runJob(demo, tomorrow(today));

    const row = await penaltyOn(demo, cantonese, today);
    expect(row).toMatchObject({
      status: "failed",
      attempts: 3,
      failureMessage: "カードが拒否されました",
    });
    expect(row.chargeReference).toStartWith("pi_");
    const keys = stripe.charges
      .filter((c) => c.params.metadata?.penalty_id === row.id)
      .map((c) => c.idempotencyKey);
    expect(keys).toEqual([1, 2, 3].map((n) => `penalty:${row.id}:${n}`));

    // 失敗したものも支払うべき罰金として履歴に出る
    const detail = await caller.consumer.commitment.get({ id: cantonese, today });
    expect(detail.penalties[0]).toMatchObject({
      dueDate: today,
      status: "failed",
      failureMessage: "カードが拒否されました",
    });
  });

  test("本人認証が必要なカードは、その理由を残す", async () => {
    const demo = await setupDemo();
    demo.stripe.willCharge("authentication_required");
    await runJob(demo, tomorrow(demo.today));

    const row = await penaltyOn(demo, demo.seeded.commitmentIds[0]!, demo.today);
    expect(row.failureMessage).toBe("カードの本人認証が必要なため引き落とせませんでした");
  });

  test("Stripe 側で処理中になったものは、試し直さずに Webhook を待つ", async () => {
    const demo = await setupDemo();
    demo.stripe.willCharge("processing");
    const first = await runJob(demo, tomorrow(demo.today));
    expect(first.processing).toBe(first.created);
    const charges = demo.stripe.charges.length;

    await runJob(demo, tomorrow(demo.today));
    expect(demo.stripe.charges.length).toBe(charges);
    const row = await penaltyOn(demo, demo.seeded.commitmentIds[0]!, demo.today);
    expect(row.status).toBe("processing");
  });

  test("支払い方法がない罰金は、Stripe を呼ばずに徴収できなかったものとして残す", async () => {
    const demo = await setupDemo();
    const cantonese = demo.seeded.commitmentIds[0]!;
    await demo.db
      .update(commitment)
      .set({ paymentMethodId: null })
      .where(eq(commitment.id, cantonese));

    await runJob(demo, tomorrow(demo.today));
    const row = await penaltyOn(demo, cantonese, demo.today);
    expect(row).toMatchObject({
      status: "failed",
      failureMessage: "支払い方法が登録されていません",
    });
    expect(demo.stripe.charges.some((c) => c.params.metadata?.penalty_id === row.id)).toBe(false);
  });

  test("Stripe に届かなかったときも、失敗として記録して続ける", async () => {
    const demo = await setupDemo();
    demo.stripe.client.paymentIntents.create = async () => {
      throw new Error("timeout");
    };
    const result = await runJob(demo, tomorrow(demo.today));
    expect(result.failed).toBe(result.created);
    const row = await penaltyOn(demo, demo.seeded.commitmentIds[0]!, demo.today);
    expect(row.failureMessage).toBe("timeout");
  });
});

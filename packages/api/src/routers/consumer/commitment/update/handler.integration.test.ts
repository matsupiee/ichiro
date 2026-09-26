import { describe, expect, test } from "bun:test";
import { commitment, penalty } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { addDays } from "../../../../shared/date/add-days";
import { runPenaltyJob } from "../../../../shared/penalty/run-penalty-job";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

const values = {
  goal: "読書",
  content: "毎日10ページ読む",
  frequency: "daily" as const,
  weekdays: [1, 3, 5],
  monthDays: [1],
  untilDate: "2099-12-31",
  penaltyAmount: null,
  paymentMethodId: null,
  checker: "self" as const,
  friendEmail: null,
};

describe("途中で設定を変えられる", () => {
  test("期間中でも設定を変更でき、開始日と報告履歴はそのまま残る", async () => {
    const { caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;
    const before = await caller.consumer.commitment.get({ id, today });

    await caller.consumer.commitment.update({
      id,
      values: {
        ...values,
        goal: "広東語ペラペラ",
        penaltyAmount: 1500,
        paymentMethodId: seeded.paymentMethodIds[1]!,
      },
    });
    const after = await caller.consumer.commitment.get({ id, today });

    expect(after).toMatchObject({
      goal: "広東語ペラペラ",
      penaltyAmount: 1500,
      paymentMethodId: seeded.paymentMethodIds[1],
      startDate: before.startDate,
      streak: before.streak,
    });
  });

  test("終了日を開始日より前にはできない", async () => {
    const { caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;
    const { startDate } = await caller.consumer.commitment.get({ id, today });
    await expect(
      caller.consumer.commitment.update({
        id,
        values: { ...values, untilDate: addDays(startDate, -1) },
      }),
    ).rejects.toThrow("終了日は開始日以降にしてください");
  });

  test("ほかのユーザーのコミットメントは変えられない", async () => {
    const { db, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    await expect(
      other.consumer.commitment.update({ id: seeded.commitmentIds[0]!, values }),
    ).rejects.toThrow("コミットメントが見つかりません");
  });
});

describe("設定を変えても、過去の分の罰金は変わらない", () => {
  // デモデータは UTC で作るので、翌日の 0:30（UTC）には今日の締め切りが過ぎている
  const tomorrow = (today: string) => new Date(`${addDays(today, 1)}T00:30:00Z`);

  test("締め切りを過ぎた分は、変更前の金額と支払い方法で徴収する", async () => {
    const { db, caller, today, seeded, stripe } = await setupDemo();
    const [applePay, card] = seeded.paymentMethodIds as [string, string];
    const created = await caller.consumer.commitment.create({
      today,
      timeZone: "UTC",
      values: { ...values, penaltyAmount: 500, paymentMethodId: card },
    });
    // 3日前に始めて、おとといと昨日は報告しなかった（まだ cron が回っていない）
    await db
      .update(commitment)
      .set({ startDate: addDays(today, -3), settledThrough: addDays(today, -3) })
      .where(eq(commitment.id, created.id));

    await caller.consumer.commitment.update({
      id: created.id,
      values: { ...values, penaltyAmount: 2000, paymentMethodId: applePay },
    });
    await runPenaltyJob(db, stripe.client, tomorrow(today));

    const rows = await db
      .select()
      .from(penalty)
      .where(eq(penalty.commitmentId, created.id))
      .orderBy(penalty.dueDate);
    expect(rows.map((p) => [p.dueDate, p.amount, p.paymentMethodId])).toEqual([
      [addDays(today, -2), 500, card],
      [addDays(today, -1), 500, card],
      [today, 2000, applePay],
    ]);
  });

  test("終了日を延ばしても、終わっていた期間の分はさかのぼって徴収しない", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    const card = seeded.paymentMethodIds[1]!;
    const created = await caller.consumer.commitment.create({
      today,
      timeZone: "UTC",
      values: { ...values, penaltyAmount: 500, paymentMethodId: card },
    });
    // 10日前から5日前まで続けて、全部報告できたコミットメント
    await db
      .update(commitment)
      .set({
        startDate: addDays(today, -10),
        untilDate: addDays(today, -5),
        settledThrough: addDays(today, -5),
      })
      .where(eq(commitment.id, created.id));

    await caller.consumer.commitment.update({
      id: created.id,
      values: {
        ...values,
        penaltyAmount: 500,
        paymentMethodId: card,
        untilDate: addDays(today, 30),
      },
    });
    const detail = await caller.consumer.commitment.get({ id: created.id, today });
    expect(detail.penalties).toEqual([]);
    expect(detail.settledThrough).toBe(addDays(today, -1));
  });
});

describe("設定を変えると、新しい友達に招待メールが届く", () => {
  test("自分から友達に変えると送る", async () => {
    const { caller, today, seeded, mailer } = await setupDemo();
    const id = seeded.commitmentIds[0]!;
    const updated = await caller.consumer.commitment.update({
      id,
      values: { ...values, checker: "friend", friendEmail: "new-friend@example.com" },
    });
    expect(updated.invitation).toMatchObject({ kind: "sign_up", status: "sent" });
    expect(mailer.outbox.map((m) => m.to)).toEqual(["new-friend@example.com"]);
    expect((await caller.consumer.commitment.get({ id, today })).invitation).toMatchObject({
      email: "new-friend@example.com",
    });
  });

  test("友達のメールアドレスを変えると、新しいアドレスに送る", async () => {
    const { caller, seeded, mailer } = await setupDemo();
    const updated = await caller.consumer.commitment.update({
      id: seeded.commitmentIds[1]!,
      values: { ...values, checker: "friend", friendEmail: "another@example.com" },
    });
    expect(updated.invitation).toMatchObject({ email: "another@example.com" });
    expect(mailer.outbox.map((m) => m.to)).toEqual(["another@example.com"]);
  });

  test("同じ友達のまま、ほかの設定だけ変えたときは送らない", async () => {
    const { caller, seeded, mailer } = await setupDemo();
    const updated = await caller.consumer.commitment.update({
      id: seeded.commitmentIds[1]!,
      values: {
        ...values,
        goal: "体づくり2",
        checker: "friend",
        friendEmail: "matsukiyo@example.com",
      },
    });
    expect(updated.invitation).toBeNull();
    expect(mailer.outbox).toHaveLength(0);
  });
});

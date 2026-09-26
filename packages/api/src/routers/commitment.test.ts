import { describe, expect, test } from "bun:test";
import { commitment, penalty } from "@ichiro/db/schema/index";
import { and, eq } from "drizzle-orm";

import type { PaymentGateway } from "../lib/payment";
import { stubPaymentGateway } from "../lib/payment";
import { runPenaltyJob } from "../lib/penalty";
import { addDays } from "../lib/schedule";
import { callerFor, createUser, setupDemo } from "../test/helpers";

const values = {
  goal: "読書",
  content: "毎日10ページ読む",
  frequency: "daily" as const,
  weekdays: [1, 3, 5],
  monthDays: [1],
  untilDate: "2099-12-31",
  penaltyAmount: null,
  paymentMethod: null,
  checker: "self" as const,
  friendEmail: null,
};

describe("メインページでコミットメントを一覧できる", () => {
  test("自分のコミットメントが新しい順に、今日の報告状況と連続達成つきで返る", async () => {
    const { caller, today } = await setupDemo();
    const list = await caller.commitment.list({ today });

    expect(list.map((c) => c.goal)).toEqual(["広東語マスター", "体づくり", "禁煙"]);
    const cantonese = list.find((c) => c.goal === "広東語マスター")!;
    expect(cantonese).toMatchObject({ dueToday: true, reportedToday: false, streak: 7 });
    const smoking = list.find((c) => c.goal === "禁煙")!;
    expect(smoking).toMatchObject({ dueToday: true, reportedToday: true, streak: 42 });
  });

  test("ほかのユーザーのコミットメントは見えない", async () => {
    const { db, today } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    expect(await other.commitment.list({ today })).toEqual([]);
  });

  test("ログインしていないと一覧できない", async () => {
    const { db, today } = await setupDemo();
    await expect(callerFor(db, null).commitment.list({ today })).rejects.toThrow(
      "Authentication required",
    );
  });
});

describe("コミットメントを作成できる", () => {
  test("作成すると今日が開始日になり、一覧の先頭に出る", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.commitment.create({ today, values });

    expect(created.startDate).toBe(today);
    const list = await caller.commitment.list({ today });
    expect(list[0]).toMatchObject({ id: created.id, goal: "読書", streak: 0 });
  });

  test("罰金は100円未満にできない", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.commitment.create({
        today,
        values: { ...values, penaltyAmount: 99, paymentMethod: "apple_pay" },
      }),
    ).rejects.toThrow("罰金は100円以上にしてください");
  });

  test("罰金を設定するなら支払い方法が必要", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.commitment.create({ today, values: { ...values, penaltyAmount: 500 } }),
    ).rejects.toThrow("支払い方法を選んでください");
  });

  test("罰金なしなら支払い方法は保存されない", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      values: { ...values, paymentMethod: "card" },
    });
    expect(created.paymentMethod).toBeNull();
  });

  test("友達にチェックしてもらうならメールアドレスが必要", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.commitment.create({ today, values: { ...values, checker: "friend" } }),
    ).rejects.toThrow("友達のメールアドレスを入力してください");

    const created = await caller.commitment.create({
      today,
      values: { ...values, checker: "friend", friendEmail: "friend@example.com" },
    });
    expect(created.friendEmail).toBe("friend@example.com");
  });

  test("曜日ごとなら曜日を、月の特定の日なら日付を1つ以上選ぶ", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.commitment.create({ today, values: { ...values, frequency: "weekly", weekdays: [] } }),
    ).rejects.toThrow("曜日を選んでください");
    await expect(
      caller.commitment.create({
        today,
        values: { ...values, frequency: "monthly", monthDays: [] },
      }),
    ).rejects.toThrow("日付を選んでください");
  });

  test("終了日を過去にはできない", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.commitment.create({ today, values: { ...values, untilDate: addDays(today, -1) } }),
    ).rejects.toThrow("終了日は今日以降にしてください");
  });
});

describe("コミットメントの詳細を見て、途中で設定を変えられる", () => {
  test("詳細には今週の達成状況が月曜はじまりで入る", async () => {
    const { caller, today, seeded } = await setupDemo();
    const detail = await caller.commitment.get({ id: seeded.commitmentIds[2]!, today });

    expect(detail.goal).toBe("禁煙");
    expect(detail.week).toHaveLength(7);
    const todayCell = detail.week.find((d) => d.date === today)!;
    expect(todayCell.reported).toBe(true);
    expect(detail.week.filter((d) => d.date > today).every((d) => !d.reported)).toBe(true);
  });

  test("期間中でも設定を変更でき、開始日と報告履歴はそのまま残る", async () => {
    const { caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;
    const before = await caller.commitment.get({ id, today });

    await caller.commitment.update({
      id,
      values: {
        ...values,
        goal: "広東語ペラペラ",
        penaltyAmount: 1500,
        paymentMethod: "card",
      },
    });
    const after = await caller.commitment.get({ id, today });

    expect(after).toMatchObject({
      goal: "広東語ペラペラ",
      penaltyAmount: 1500,
      paymentMethod: "card",
      startDate: before.startDate,
      streak: before.streak,
    });
  });

  test("ほかのユーザーのコミットメントは見ることも変えることもできない", async () => {
    const { db, today, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    const id = seeded.commitmentIds[0]!;

    await expect(other.commitment.get({ id, today })).rejects.toThrow(
      "コミットメントが見つかりません",
    );
    await expect(other.commitment.update({ id, values })).rejects.toThrow(
      "コミットメントが見つかりません",
    );
    await expect(other.commitment.report({ id, today })).rejects.toThrow(
      "コミットメントが見つかりません",
    );
  });
});

describe("今日の達成を報告できる", () => {
  test("報告すると連続達成が1つ増え、一覧でも報告ずみになる", async () => {
    const { caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;

    const result = await caller.commitment.report({ id, today });
    expect(result.streak).toBe(8);

    const item = (await caller.commitment.list({ today })).find((c) => c.id === id)!;
    expect(item).toMatchObject({ reportedToday: true, streak: 8 });
  });

  test("同じ日に二重には報告できない", async () => {
    const { caller, today, seeded } = await setupDemo();
    await expect(caller.commitment.report({ id: seeded.commitmentIds[2]!, today })).rejects.toThrow(
      "今日はもう報告ずみです",
    );
  });

  test("報告日でない日には報告できない", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      values: { ...values, frequency: "once", untilDate: addDays(today, 7) },
    });
    await expect(caller.commitment.report({ id: created.id, today })).rejects.toThrow(
      "今日は報告日ではありません",
    );
  });

  test("何日も前の日付では報告できない", async () => {
    const { caller, today, seeded } = await setupDemo();
    await expect(
      caller.commitment.report({ id: seeded.commitmentIds[0]!, today: addDays(today, -3) }),
    ).rejects.toThrow("今日の日付が正しくありません");
  });
});

describe("報告できなかった日は罰金が徴収される", () => {
  // デモデータは UTC で作るので、翌日の 0:30（UTC）には今日の締め切りが過ぎている
  const tomorrow = (today: string) => new Date(`${addDays(today, 1)}T00:30:00Z`);

  test("締め切りを過ぎると、未報告の日の罰金ができて引き落とされ、詳細の履歴に出る", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    const cantonese = seeded.commitmentIds[0]!;

    const before = await caller.commitment.get({ id: cantonese, today });
    expect(before.penalties.map((p) => p.dueDate)).toEqual([
      addDays(today, -8),
      addDays(today, -15),
    ]);
    expect(before.penaltyTotal).toBe(1000);

    const result = await runPenaltyJob(db, stubPaymentGateway, tomorrow(today));
    expect(result.failed).toBe(0);
    expect(result.paid).toBe(result.created);

    const after = await caller.commitment.get({ id: cantonese, today });
    expect(after.penalties[0]).toMatchObject({
      dueDate: today,
      amount: 500,
      paymentMethod: "apple_pay",
      status: "paid",
    });
    expect(after.penaltyTotal).toBe(1500);

    // 今日も報告ずみの「禁煙」には罰金がかからない
    const smoking = await caller.commitment.get({ id: seeded.commitmentIds[2]!, today });
    expect(smoking.penalties).toEqual([]);
  });

  test("締め切り前に報告すれば罰金はかからない", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;
    await caller.commitment.report({ id, today });

    await runPenaltyJob(db, stubPaymentGateway, tomorrow(today));
    const detail = await caller.commitment.get({ id, today });
    expect(detail.penalties.map((p) => p.dueDate)).not.toContain(today);
  });

  test("同じ日の罰金を二重に徴収しない", async () => {
    const { db, today } = await setupDemo();
    const first = await runPenaltyJob(db, stubPaymentGateway, tomorrow(today));
    expect(first.created).toBeGreaterThan(0);
    const second = await runPenaltyJob(db, stubPaymentGateway, tomorrow(today));
    expect(second).toEqual({ created: 0, paid: 0, failed: 0 });
  });

  test("罰金を設定していないコミットメントでは徴収しない", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.commitment.create({ today, timeZone: "UTC", values });

    await runPenaltyJob(db, stubPaymentGateway, new Date(`${addDays(today, 3)}T00:30:00Z`));
    const detail = await caller.commitment.get({ id: created.id, today });
    expect(detail.penalties).toEqual([]);
  });

  test("締め切りを過ぎた日には、あとから報告できない", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    await runPenaltyJob(db, stubPaymentGateway, tomorrow(today));

    await expect(caller.commitment.report({ id: seeded.commitmentIds[0]!, today })).rejects.toThrow(
      "締め切りを過ぎたため報告できません",
    );
  });

  test("設定を変えても、締め切りを過ぎた分は変更前の金額で徴収する", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      timeZone: "UTC",
      values: { ...values, penaltyAmount: 500, paymentMethod: "card" },
    });
    // 3日前に始めて、おとといと昨日は報告しなかった（まだ cron が回っていない）
    await db
      .update(commitment)
      .set({ startDate: addDays(today, -3), settledThrough: addDays(today, -3) })
      .where(eq(commitment.id, created.id));

    await caller.commitment.update({
      id: created.id,
      values: { ...values, penaltyAmount: 2000, paymentMethod: "apple_pay" },
    });
    await runPenaltyJob(db, stubPaymentGateway, tomorrow(today));

    const detail = await caller.commitment.get({ id: created.id, today });
    expect(detail.penalties.map((p) => [p.dueDate, p.amount, p.paymentMethod])).toEqual([
      [today, 2000, "apple_pay"],
      [addDays(today, -1), 500, "card"],
      [addDays(today, -2), 500, "card"],
    ]);
  });

  test("終了日を延ばしても、終わっていた期間の分はさかのぼって徴収しない", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      timeZone: "UTC",
      values: { ...values, penaltyAmount: 500, paymentMethod: "card" },
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

    await caller.commitment.update({
      id: created.id,
      values: {
        ...values,
        penaltyAmount: 500,
        paymentMethod: "card",
        untilDate: addDays(today, 30),
      },
    });
    const detail = await caller.commitment.get({ id: created.id, today });
    expect(detail.penalties).toEqual([]);
    expect(detail.settledThrough).toBe(addDays(today, -1));
  });

  test("この機能より前に作られたコミットメントは、過去の分をさかのぼらない", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;
    await db.delete(penalty).where(eq(penalty.commitmentId, id));
    await db.update(commitment).set({ settledThrough: null }).where(eq(commitment.id, id));

    const result = await runPenaltyJob(db, stubPaymentGateway);
    const detail = await caller.commitment.get({ id, today });
    expect(detail.penalties).toEqual([]);
    expect(detail.settledThrough).toBe(addDays(today, -1));
    expect(result.created).toBe(0);
  });

  test("引き落としに失敗したら、3回まで試し直す", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    let calls = 0;
    const declined: PaymentGateway = {
      async charge() {
        calls++;
        return { ok: false, message: "カードが拒否されました" };
      },
    };

    for (let i = 0; i < 4; i++) await runPenaltyJob(db, declined, tomorrow(today));

    const [row] = await db
      .select()
      .from(penalty)
      .where(and(eq(penalty.commitmentId, seeded.commitmentIds[0]!), eq(penalty.dueDate, today)));
    expect(row).toMatchObject({
      dueDate: today,
      status: "failed",
      attempts: 3,
      failureMessage: "カードが拒否されました",
    });
    const failedCount = (await db.select().from(penalty).where(eq(penalty.status, "failed")))
      .length;
    expect(calls).toBe(failedCount * 3);

    // 失敗したものも支払うべき罰金として履歴に出る
    const detail = await caller.commitment.get({ id: seeded.commitmentIds[0]!, today });
    expect(detail.penalties[0]).toMatchObject({ dueDate: today, status: "failed" });

    // 決済サービスが例外を投げても、失敗として記録して続ける
    const { db: db2, today: today2 } = await setupDemo();
    const throwing: PaymentGateway = {
      async charge() {
        throw new Error("timeout");
      },
    };
    const result = await runPenaltyJob(db2, throwing, tomorrow(today2));
    expect(result.failed).toBe(result.created);
  });

  test("タイムゾーンを保存し、正しくないものは受け付けない", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      timeZone: "America/Los_Angeles",
      values,
    });
    expect(created.timeZone).toBe("America/Los_Angeles");
    expect(created.settledThrough).toBe(addDays(today, -1));

    await expect(
      caller.commitment.create({ today, timeZone: "Mars/Olympus", values }),
    ).rejects.toThrow("タイムゾーンが正しくありません");
  });
});

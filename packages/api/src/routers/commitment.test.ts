import { describe, expect, test } from "bun:test";

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

import { describe, expect, test } from "bun:test";

import { addDays } from "../../../../shared/date/add-days";
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
};

describe("コミットメントを作成できる", () => {
  test("作成すると今日が開始日になり、一覧の先頭に出る", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, values });

    expect(created.startDate).toBe(today);
    const list = await caller.consumer.commitment.list({ today });
    expect(list[0]).toMatchObject({ id: created.id, goal: "読書", streak: 0 });
  });

  test("罰金は100円未満にできない", async () => {
    const { caller, today, seeded } = await setupDemo();
    await expect(
      caller.consumer.commitment.create({
        today,
        values: { ...values, penaltyAmount: 99, paymentMethodId: seeded.paymentMethodIds[0]! },
      }),
    ).rejects.toThrow("罰金は100円以上にしてください");
  });

  test("罰金を設定するなら支払い方法が必要", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.consumer.commitment.create({ today, values: { ...values, penaltyAmount: 500 } }),
    ).rejects.toThrow("支払い方法を選んでください");
  });

  test("罰金なしなら支払い方法は保存されない", async () => {
    const { caller, today, seeded } = await setupDemo();
    const created = await caller.consumer.commitment.create({
      today,
      values: { ...values, paymentMethodId: seeded.paymentMethodIds[1]! },
    });
    expect(created.paymentMethodId).toBeNull();
  });

  test("罰金は、自分が登録した支払い方法でしか設定できない", async () => {
    const { db, today, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    await expect(
      other.consumer.commitment.create({
        today,
        values: { ...values, penaltyAmount: 500, paymentMethodId: seeded.paymentMethodIds[0]! },
      }),
    ).rejects.toThrow("支払い方法が見つかりません");
  });

  test("曜日ごとなら曜日を、月の特定の日なら日付を1つ以上選ぶ", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.consumer.commitment.create({
        today,
        values: { ...values, frequency: "weekly", weekdays: [] },
      }),
    ).rejects.toThrow("曜日を選んでください");
    await expect(
      caller.consumer.commitment.create({
        today,
        values: { ...values, frequency: "monthly", monthDays: [] },
      }),
    ).rejects.toThrow("日付を選んでください");
  });

  test("終了日を過去にはできない", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.consumer.commitment.create({
        today,
        values: { ...values, untilDate: addDays(today, -1) },
      }),
    ).rejects.toThrow("終了日は今日以降にしてください");
  });

  test("タイムゾーンを保存し、今日の分から精算の対象にする。正しくないタイムゾーンは受け付けない", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({
      today,
      timeZone: "America/Los_Angeles",
      values,
    });
    expect(created.timeZone).toBe("America/Los_Angeles");
    expect(created.settledThrough).toBe(addDays(today, -1));

    await expect(
      caller.consumer.commitment.create({ today, timeZone: "Mars/Olympus", values }),
    ).rejects.toThrow("タイムゾーンが正しくありません");
  });

  test("ログインしていないと作成できない", async () => {
    const { db, today } = await setupDemo();
    await expect(callerFor(db, null).consumer.commitment.create({ today, values })).rejects.toThrow(
      "Authentication required",
    );
  });
});

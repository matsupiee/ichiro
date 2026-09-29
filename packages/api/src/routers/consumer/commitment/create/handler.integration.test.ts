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
  friendEmail: null,
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

describe("友達にチェックしてもらうなら、作成したときに招待メールを送る", () => {
  const friendValues = {
    ...values,
    checker: "friend" as const,
    friendEmail: "new-friend@example.com",
  };

  test("友達にチェックしてもらうならメールアドレスが必要", async () => {
    const { caller, today } = await setupDemo();
    await expect(
      caller.consumer.commitment.create({ today, values: { ...values, checker: "friend" } }),
    ).rejects.toThrow("友達のメールアドレスを入力してください");
  });

  test("まだ登録していない友達には、会員登録のお願いが届く", async () => {
    const { caller, today, mailer } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, values: friendValues });

    expect(created.friendEmail).toBe("new-friend@example.com");
    expect(created.invitation).toMatchObject({
      email: "new-friend@example.com",
      kind: "sign_up",
      status: "sent",
    });
    expect(mailer.outbox).toHaveLength(1);
    const mail = mailer.outbox[0]!;
    expect(mail.to).toBe("new-friend@example.com");
    expect(mail.subject).toBe("taroさんから、ichiro への招待が届きました");
    expect(mail.text).toContain("taroさん（demo@ichiro.app）");
    expect(mail.text).toContain("目標: 読書");
    expect(mail.text).toContain("コミット内容: 毎日10ページ読む");
    expect(mail.text).toContain("このメールアドレス（new-friend@example.com）で会員登録");
  });

  test("登録ずみの友達には、チェック役のお願いが届く", async () => {
    const { caller, today, seeded, mailer } = await setupDemo();
    const created = await caller.consumer.commitment.create({
      today,
      values: {
        ...friendValues,
        friendEmail: "tanaka@Example.com",
        penaltyAmount: 1000,
        paymentMethodId: seeded.paymentMethodIds[1]!,
      },
    });

    expect(created.friendEmail).toBe("tanaka@example.com");
    expect(created.invitation).toMatchObject({ kind: "registered", status: "sent" });
    const mail = mailer.outbox[0]!;
    expect(mail.subject).toBe("taroさんから、チェック役のお願いが届きました");
    expect(mail.text).toContain("罰金: ¥1,000");
    expect(mail.text).not.toContain("会員登録");
  });

  test("自分でチェックするときは送らず、友達のメールアドレスも保存しない", async () => {
    const { caller, today, mailer } = await setupDemo();
    const created = await caller.consumer.commitment.create({
      today,
      values: { ...friendValues, checker: "self" },
    });
    expect(created.invitation).toBeNull();
    expect(created.friendEmail).toBeNull();
    expect(mailer.outbox).toHaveLength(0);
  });

  test("自分のメールアドレスは友達に指定できない", async () => {
    const { caller, today, mailer } = await setupDemo();
    await expect(
      caller.consumer.commitment.create({
        today,
        values: { ...friendValues, friendEmail: "DEMO@ichiro.app" },
      }),
    ).rejects.toThrow("自分のメールアドレスは指定できません");
    expect(mailer.outbox).toHaveLength(0);
  });

  test("送れなくてもコミットメントは作られ、失敗として残る", async () => {
    const { caller, today, mailer } = await setupDemo();
    mailer.failing = true;
    const created = await caller.consumer.commitment.create({ today, values: friendValues });

    expect(created.invitation).toMatchObject({ status: "failed" });
    const detail = await caller.consumer.commitment.get({ id: created.id, today });
    expect(detail.invitation).toMatchObject({ status: "failed" });
  });
});

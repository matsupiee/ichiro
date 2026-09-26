import { describe, expect, test } from "bun:test";

import { invitation } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { invitationEmail } from "../lib/invitation-email";
import { createLogMailer } from "../lib/mailer";
import { callerFor, createUser, setupDemo } from "../test/helpers";

const values = {
  goal: "読書",
  content: "毎日10ページ読む",
  frequency: "daily" as const,
  weekdays: [1, 3, 5],
  monthDays: [1],
  untilDate: "2099-12-31",
  penaltyAmount: null,
  paymentMethodId: null,
  checker: "friend" as const,
  friendEmail: "new-friend@example.com",
};

describe("友達に招待メールを送れる", () => {
  test("まだ登録していない友達には、会員登録のお願いが届く", async () => {
    const { caller, today, mailer } = await setupDemo();
    const created = await caller.commitment.create({ today, values });

    expect(created.invitation).toMatchObject({
      email: "new-friend@example.com",
      kind: "sign_up",
      status: "sent",
    });
    expect(mailer.outbox).toHaveLength(1);
    const mail = mailer.outbox[0]!;
    expect(mail.to).toBe("new-friend@example.com");
    expect(mail.subject).toBe("hiromuさんから、ichiro への招待が届きました");
    expect(mail.text).toContain("hiromuさん（demo@ichiro.app）");
    expect(mail.text).toContain("目標: 読書");
    expect(mail.text).toContain("コミット内容: 毎日10ページ読む");
    expect(mail.text).toContain("このメールアドレス（new-friend@example.com）で会員登録");
  });

  test("登録ずみの友達には、チェック役のお願いが届く", async () => {
    const { caller, today, seeded, mailer } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      values: {
        ...values,
        friendEmail: "Matsukiyo@Example.com",
        penaltyAmount: 1000,
        paymentMethodId: seeded.paymentMethodIds[1]!,
      },
    });

    expect(created.friendEmail).toBe("matsukiyo@example.com");
    expect(created.invitation).toMatchObject({ kind: "registered", status: "sent" });
    const mail = mailer.outbox[0]!;
    expect(mail.subject).toBe("hiromuさんから、チェック役のお願いが届きました");
    expect(mail.text).toContain("罰金: ¥1,000");
    expect(mail.text).not.toContain("会員登録");
  });

  test("自分でチェックするときは送らない", async () => {
    const { caller, today, mailer } = await setupDemo();
    const created = await caller.commitment.create({
      today,
      values: { ...values, checker: "self", friendEmail: "new-friend@example.com" },
    });
    expect(created.invitation).toBeNull();
    expect(mailer.outbox).toHaveLength(0);
  });

  test("自分のメールアドレスは友達に指定できない", async () => {
    const { caller, today, mailer } = await setupDemo();
    await expect(
      caller.commitment.create({ today, values: { ...values, friendEmail: "DEMO@ichiro.app" } }),
    ).rejects.toThrow("自分のメールアドレスは指定できません");
    expect(mailer.outbox).toHaveLength(0);
  });

  test("送れなくてもコミットメントは作られ、失敗として残る", async () => {
    const { caller, today, mailer } = await setupDemo();
    mailer.failing = true;
    const created = await caller.commitment.create({ today, values });

    expect(created.invitation).toMatchObject({ status: "failed" });
    const detail = await caller.commitment.get({ id: created.id, today });
    expect(detail.invitation).toMatchObject({ status: "failed" });
  });

  test("詳細には、いまの友達に最後に送った招待が入る", async () => {
    const { caller, today, seeded } = await setupDemo();
    const [cantonese, gym, smoking] = seeded.commitmentIds;

    expect((await caller.commitment.get({ id: gym!, today })).invitation).toMatchObject({
      email: "matsukiyo@example.com",
      kind: "registered",
      status: "sent",
    });
    expect((await caller.commitment.get({ id: smoking!, today })).invitation).toMatchObject({
      email: "mom@example.com",
      kind: "sign_up",
    });
    expect((await caller.commitment.get({ id: cantonese!, today })).invitation).toBeNull();
  });
});

describe("設定を変えると、新しい友達に招待メールが届く", () => {
  const { goal, content, frequency, weekdays, monthDays } = values;
  const gymValues = {
    goal,
    content,
    frequency,
    weekdays,
    monthDays,
    untilDate: "2099-12-31",
    penaltyAmount: null,
    paymentMethodId: null,
  };

  test("自分から友達に変えると送る", async () => {
    const { caller, today, seeded, mailer } = await setupDemo();
    const updated = await caller.commitment.update({
      id: seeded.commitmentIds[0]!,
      values: { ...gymValues, checker: "friend", friendEmail: "new-friend@example.com" },
    });
    expect(updated.invitation).toMatchObject({ kind: "sign_up", status: "sent" });
    expect(mailer.outbox.map((m) => m.to)).toEqual(["new-friend@example.com"]);
    expect(
      (await caller.commitment.get({ id: seeded.commitmentIds[0]!, today })).invitation,
    ).toMatchObject({ email: "new-friend@example.com" });
  });

  test("友達のメールアドレスを変えると、新しいアドレスに送る", async () => {
    const { caller, seeded, mailer } = await setupDemo();
    const updated = await caller.commitment.update({
      id: seeded.commitmentIds[1]!,
      values: { ...gymValues, checker: "friend", friendEmail: "another@example.com" },
    });
    expect(updated.invitation).toMatchObject({ email: "another@example.com" });
    expect(mailer.outbox.map((m) => m.to)).toEqual(["another@example.com"]);
  });

  test("同じ友達のまま、ほかの設定だけ変えたときは送らない", async () => {
    const { caller, seeded, mailer } = await setupDemo();
    const updated = await caller.commitment.update({
      id: seeded.commitmentIds[1]!,
      values: {
        ...gymValues,
        goal: "体づくり2",
        checker: "friend",
        friendEmail: "matsukiyo@example.com",
      },
    });
    expect(updated.invitation).toBeNull();
    expect(mailer.outbox).toHaveLength(0);
  });
});

describe("招待メールを再送できる", () => {
  test("前回から1分たっていれば再送できる", async () => {
    const { db, caller, seeded, mailer } = await setupDemo();
    const id = seeded.commitmentIds[1]!;
    await db
      .update(invitation)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(invitation.commitmentId, id));

    const resent = await caller.commitment.resendInvitation({ id });
    expect(resent).toMatchObject({
      email: "matsukiyo@example.com",
      kind: "registered",
      status: "sent",
    });
    expect(mailer.outbox).toHaveLength(1);
  });

  test("送ったばかりなら再送できない", async () => {
    const { caller, seeded, mailer } = await setupDemo();
    await expect(
      caller.commitment.resendInvitation({ id: seeded.commitmentIds[1]! }),
    ).rejects.toThrow("少し時間をおいてから再送してください");
    expect(mailer.outbox).toHaveLength(0);
  });

  test("前回送れなかったなら、すぐに再送できる", async () => {
    const { caller, today, mailer } = await setupDemo();
    mailer.failing = true;
    const created = await caller.commitment.create({ today, values });
    mailer.failing = false;

    const resent = await caller.commitment.resendInvitation({ id: created.id });
    expect(resent.status).toBe("sent");
    expect((await caller.commitment.get({ id: created.id, today })).invitation?.status).toBe(
      "sent",
    );
  });

  test("自分でチェックするコミットメントには再送できない", async () => {
    const { caller, seeded } = await setupDemo();
    await expect(
      caller.commitment.resendInvitation({ id: seeded.commitmentIds[0]! }),
    ).rejects.toThrow("友達にチェックしてもらう設定になっていません");
  });

  test("ほかのユーザーのコミットメントには再送できない", async () => {
    const { db, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    await expect(
      other.commitment.resendInvitation({ id: seeded.commitmentIds[1]! }),
    ).rejects.toThrow("コミットメントが見つかりません");
  });
});

describe("招待メールの本文", () => {
  const base = {
    to: "friend@example.com",
    inviter: { name: "<b>hiromu</b>", email: "demo@ichiro.app" },
    commitment: {
      goal: "体づくり & 筋トレ",
      content: "週3でジム",
      frequency: "weekly" as const,
      weekdays: [1, 3, 5],
      monthDays: [1],
      startDate: "2026-09-01",
      untilDate: "2026-12-31",
      penaltyAmount: null,
      checker: "friend" as const,
    },
  };

  test("頻度と期間が読める形で入る", () => {
    const mail = invitationEmail({ ...base, kind: "registered" });
    expect(mail.text).toContain("報告の頻度: 毎週 月・水・金");
    expect(mail.text).toContain("期間: 2026/9/1〜2026/12/31");
    expect(mail.text).not.toContain("罰金");

    const once = invitationEmail({
      ...base,
      kind: "registered",
      commitment: { ...base.commitment, frequency: "once" },
    });
    expect(once.text).toContain("報告の頻度: 2026/12/31 の1回だけ");
    expect(once.text).toContain("実施日: 2026/12/31");
  });

  test("HTML では名前や目標をエスケープする", () => {
    const mail = invitationEmail({ ...base, kind: "sign_up" });
    expect(mail.html).toContain("&lt;b&gt;hiromu&lt;/b&gt;");
    expect(mail.html).toContain("体づくり &amp; 筋トレ");
    expect(mail.html).not.toContain("<b>hiromu</b>");
  });

  test("API キーがないときはログに出すだけにする", async () => {
    const lines: string[] = [];
    const mailer = createLogMailer((l) => lines.push(l));
    const sent = await mailer.send(invitationEmail({ ...base, kind: "sign_up" }));
    expect(sent.id).toBe("log-1");
    expect(lines[0]).toContain("to=friend@example.com");
  });
});

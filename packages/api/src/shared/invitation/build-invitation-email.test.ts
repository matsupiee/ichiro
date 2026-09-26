import { describe, expect, test } from "bun:test";

import { createLogMailer } from "../../third-party-lib/mailer";
import { buildInvitationEmail } from "./build-invitation-email";

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

describe("招待メールの本文", () => {
  test("頻度と期間が読める形で入る", () => {
    const mail = buildInvitationEmail({ ...base, kind: "registered" });
    expect(mail.text).toContain("報告の頻度: 毎週 月・水・金");
    expect(mail.text).toContain("期間: 2026/9/1〜2026/12/31");
    expect(mail.text).not.toContain("罰金");

    const once = buildInvitationEmail({
      ...base,
      kind: "registered",
      commitment: { ...base.commitment, frequency: "once" },
    });
    expect(once.text).toContain("報告の頻度: 2026/12/31 の1回だけ");
    expect(once.text).toContain("実施日: 2026/12/31");
  });

  test("HTML では名前や目標をエスケープする", () => {
    const mail = buildInvitationEmail({ ...base, kind: "sign_up" });
    expect(mail.html).toContain("&lt;b&gt;hiromu&lt;/b&gt;");
    expect(mail.html).toContain("体づくり &amp; 筋トレ");
    expect(mail.html).not.toContain("<b>hiromu</b>");
  });

  test("API キーがないときはログに出すだけにする", async () => {
    const lines: string[] = [];
    const mailer = createLogMailer((l) => lines.push(l));
    const sent = await mailer.send(buildInvitationEmail({ ...base, kind: "sign_up" }));
    expect(sent.id).toBe("log-1");
    expect(lines[0]).toContain("to=friend@example.com");
  });
});

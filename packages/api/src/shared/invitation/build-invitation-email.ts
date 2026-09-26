import type { Checker, CommitmentFrequency } from "@ichiro/db/schema/commitment";
import type { InvitationKind } from "@ichiro/db/schema/invitation";

import type { MailMessage } from "../../third-party-lib/mailer";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export type InvitationEmailInput = {
  kind: InvitationKind;
  to: string;
  inviter: { name: string; email: string };
  commitment: {
    goal: string;
    content: string;
    frequency: CommitmentFrequency;
    weekdays: number[];
    monthDays: number[];
    startDate: string;
    untilDate: string;
    penaltyAmount: number | null;
    checker: Checker;
  };
};

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

function describeFrequency(c: InvitationEmailInput["commitment"]): string {
  switch (c.frequency) {
    case "daily":
      return "毎日";
    case "weekly":
      return `毎週 ${c.weekdays.map((d) => DOW[d]).join("・")}`;
    case "monthly":
      return `毎月 ${c.monthDays.join("・")}日`;
    case "once":
      return `${formatDate(c.untilDate)} の1回だけ`;
  }
}

function describePeriod(c: InvitationEmailInput["commitment"]): string {
  return c.frequency === "once"
    ? formatDate(c.untilDate)
    : `${formatDate(c.startDate)}〜${formatDate(c.untilDate)}`;
}

// 友達に届く招待メール。登録ずみならチェックのお願い、未登録なら会員登録のお願いにする
export function buildInvitationEmail(input: InvitationEmailInput): MailMessage {
  const { kind, to, inviter, commitment: c } = input;
  const name = inviter.name;
  const rows: [string, string][] = [
    ["目標", c.goal],
    ["コミット内容", c.content],
    ["報告の頻度", describeFrequency(c)],
    [c.frequency === "once" ? "実施日" : "期間", describePeriod(c)],
  ];
  if (c.penaltyAmount !== null) {
    rows.push(["罰金", `¥${c.penaltyAmount.toLocaleString("ja-JP")}（報告できなかった回ごと）`]);
  }

  const subject =
    kind === "registered"
      ? `${name}さんから、チェック役のお願いが届きました`
      : `${name}さんから、ichiro への招待が届きました`;
  const intro = `${name}さん（${inviter.email}）が ichiro で目標を宣言し、あなたにチェック役をお願いしました。`;
  const action =
    kind === "registered"
      ? `ichiro アプリを開いて、${name}さんの報告を見守ってください。`
      : `ichiro はまだ使っていないようです。アプリをインストールし、このメールアドレス（${to}）で会員登録すると、${name}さんの報告を見守れます。`;
  const outro = "心当たりがない場合は、このメールを無視してください。";

  const text = [
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    action,
    "",
    outro,
  ].join("\n");

  const html = `<!doctype html>
<html lang="ja">
<body style="margin:0;padding:24px;background:#F4F4F4;font-family:-apple-system,'Hiragino Sans',sans-serif;color:#1C1C1E">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px">
    <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#FF5CF2">ichiro</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7">${escapeHtml(intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 12px 8px 0;color:#8E8E93;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
        )
        .join("\n      ")}
    </table>
    <p style="margin:20px 0 0;font-size:15px;line-height:1.7">${escapeHtml(action)}</p>
    <p style="margin:24px 0 0;font-size:12px;color:#8E8E93">${escapeHtml(outro)}</p>
  </div>
</body>
</html>`;

  return { to, subject, html, text };
}

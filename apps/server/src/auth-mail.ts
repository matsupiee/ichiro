import type { SendVerificationMail } from "@ichiro/auth";

type MailConfig = {
  APP_ENV: string;
  AUTH_EMAIL_DELIVERY: string;
  RESEND_API_KEY: string;
  AUTH_EMAIL_FROM: string;
};

export function createAuthMailer(
  env: MailConfig,
  request: typeof fetch = fetch,
): SendVerificationMail {
  return async ({ email, otp, type }) => {
    if (env.AUTH_EMAIL_DELIVERY === "console") {
      if (env.APP_ENV !== "development" && env.APP_ENV !== "test")
        throw new Error("Local mail delivery is disabled outside development");
      console.info(JSON.stringify({ event: "local-auth-email", email, otp, type }));
      return;
    }
    if (env.AUTH_EMAIL_DELIVERY !== "resend" || !env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) {
      throw new Error("Resend is not configured");
    }
    const purpose = type === "change-email" ? "メールアドレス変更" : "メールアドレス確認";
    const text = `ichiro の${purpose}コードは ${otp} です。\n\nアプリにこの6桁のコードを入力してください。有効期限は5分です。\nコードを他の人に教えないでください。心当たりがない場合は、このメールを破棄してください。`;
    const response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM,
        to: [email],
        subject: `【ichiro】${purpose}コード`,
        text,
        html: `<div lang="ja"><p>ichiro の${purpose}コード</p><p style="font-size:32px;letter-spacing:6px">${otp}</p><p>アプリにこの6桁のコードを入力してください。有効期限は5分です。</p><p>コードを他の人に教えないでください。心当たりがない場合は、このメールを破棄してください。</p></div>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Resend delivery failed (${response.status})`);
    }
    await response.body?.cancel();
  };
}

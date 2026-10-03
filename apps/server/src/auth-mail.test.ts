import { expect, test } from "bun:test";
import { createAuthMailer } from "./auth-mail";
const config = {
  APP_ENV: "prod",
  AUTH_EMAIL_DELIVERY: "resend",
  RESEND_API_KEY: "re_fixture",
  AUTH_EMAIL_FROM: "ichiro <noreply@mail.ichiro.app>",
};
const mail = { email: "recipient@example.com", otp: "012345", type: "email-verification" as const };
test("Resendへ認証済み送信元・6桁コード・5分の案内を送り、成功を待つ", async () => {
  let captured: Request | undefined;
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = new Request(input, init);
    return Response.json({ id: "mail-id" });
  }) as typeof fetch;
  await createAuthMailer(config, request)(mail);
  expect(captured!.url).toBe("https://api.resend.com/emails");
  expect(captured!.headers.get("Authorization")).toBe("Bearer re_fixture");
  expect(captured!.headers.get("Idempotency-Key")).toBeTruthy();
  const body = (await captured!.json()) as { text: string; html: string };
  expect(body).toMatchObject({ from: config.AUTH_EMAIL_FROM, to: [mail.email] });
  expect(body.text).toContain("012345");
  expect(body.text).toContain("5分");
  expect(body.html).toContain("012345");
});
test("Resendの上限・障害を成功扱いせず、レスポンス本文を漏らさない", async () => {
  for (const status of [429, 500]) {
    const request = (async () =>
      new Response("private-provider-error", { status })) as unknown as typeof fetch;
    await expect(createAuthMailer(config, request)(mail)).rejects.toThrow(
      `Resend delivery failed (${status})`,
    );
  }
});
test("本番でconsoleへの退避や未設定の送信を許可しない", async () => {
  await expect(
    createAuthMailer({ ...config, AUTH_EMAIL_DELIVERY: "console" })(mail),
  ).rejects.toThrow("disabled");
  await expect(createAuthMailer({ ...config, RESEND_API_KEY: "" })(mail)).rejects.toThrow(
    "not configured",
  );
});

test("パスワード再設定メールに専用の件名とコードを記載する", async () => {
  let payload: { subject: string; text: string; html: string } | undefined;
  const request = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({ id: "reset-mail" });
  }) as typeof fetch;
  await createAuthMailer(config, request)({ ...mail, type: "forget-password" });
  expect(payload!.subject).toBe("【ichiro】パスワード再設定コード");
  expect(payload!.text).toContain("012345");
  expect(payload!.text).toContain("5分");
  expect(payload!.html).toContain("パスワード再設定");
});

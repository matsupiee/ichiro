import { expect, test } from "bun:test";
import { createAuth, type VerificationMail } from "@ichiro/auth";
import { account, rateLimit, user, verification } from "@ichiro/db/schema/auth";
import { PASSWORD_RESET_USER, seedPasswordReset } from "@ichiro/db/seed/password-reset";
import { createTestDb } from "./helpers";

const email = PASSWORD_RESET_USER.email;
const newPassword = "new-reset-password";
async function setup() {
  const db = await createTestDb();
  await seedPasswordReset(db);
  const mails: VerificationMail[] = [];
  let failDelivery = false;
  const auth = createAuth(
    {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "local-password-reset-test-secret-12345",
      CORS_ORIGIN: "http://localhost:8081",
    },
    db,
    async (mail) => {
      if (failDelivery) throw new Error("private-provider-error");
      mails.push(mail);
    },
  );
  const request = (path: string, body?: object, cookie = "") =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "expo-origin": "ichiro://",
          "cf-connecting-ip": "192.0.2.50",
          cookie,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const send = (address = email) => request("email-otp/request-password-reset", { email: address });
  const code = () => mails.at(-1)!.otp;
  const reset = (otp = code(), password = newPassword, address = email) =>
    request("email-otp/reset-password", { email: address, otp, password });
  const login = (password: string) => request("sign-in/email", { email, password });
  return {
    db,
    mails,
    request,
    send,
    code,
    reset,
    login,
    fail: () => {
      failDelivery = true;
    },
  };
}

test("再設定はメール所有を確認し、旧パスワード・既存セッション・コード再利用を無効にする", async () => {
  const t = await setup();
  const loggedIn = await t.login(PASSWORD_RESET_USER.password);
  const cookie = loggedIn.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  expect((await t.send(email.toUpperCase())).status).toBe(200);
  expect(t.mails.at(-1)).toMatchObject({ email, type: "forget-password" });
  const otp = t.code();
  expect(otp).toMatch(/^\d{6}$/);
  const [stored] = await t.db.select().from(verification);
  expect(stored!.value).not.toContain(otp);
  expect(stored!.expiresAt.getTime() - Date.now()).toBeWithin(295_000, 301_000);
  const response = await t.reset(otp, newPassword, email.toUpperCase());
  expect(response.status).toBe(200);
  expect(response.headers.getSetCookie()).toHaveLength(0);
  expect(await (await t.request("get-session", undefined, cookie)).json()).toBeNull();
  expect((await t.login(PASSWORD_RESET_USER.password)).status).toBe(401);
  expect((await t.login(newPassword)).status).toBe(200);
  expect((await t.reset(otp)).status).toBe(400);
});

test("未登録アドレスも同じ成功応答でメールを送らず、アカウントを作らない", async () => {
  const t = await setup();
  const registered = await t.send();
  const missing = await t.send("missing@example.com");
  expect(missing.status).toBe(registered.status);
  expect(await missing.json()).toEqual(await registered.json());
  expect(t.mails).toHaveLength(1);
  expect(await t.db.select().from(user)).toHaveLength(1);
  expect((await t.reset(t.code(), newPassword, "missing@example.com")).status).toBe(400);
  expect((await t.reset()).status).toBe(200);
});

test("不正メール・桁数・パスワード長を拒否し、正しい入力でやり直せる", async () => {
  const t = await setup();
  expect((await t.send("invalid")).status).toBe(400);
  await t.send();
  for (const otp of ["", "12345", "abcdef", "1234567"])
    expect((await t.reset(otp)).status).toBe(400);
  for (const password of ["short", "a".repeat(129)])
    expect((await t.reset(t.code(), password)).status).toBe(400);
  expect((await t.reset()).status).toBe(200);
});

test("誤コードは5回まで、再送で旧コードが無効になり新コードで再設定できる", async () => {
  const t = await setup();
  await t.send();
  const old = t.code();
  const wrong = old === "000000" ? "999999" : "000000";
  for (let i = 0; i < 5; i++) expect((await t.reset(wrong)).status).toBe(400);
  const limited = await t.reset();
  expect(limited.status).toBe(403);
  expect(await limited.json()).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  await t.send();
  expect((await t.reset()).status).toBe(200);
});

test("再送前のコード・期限切れ・別用途のコードは再設定に使えない", async () => {
  const t = await setup();
  await t.send();
  const old = t.code();
  await t.send();
  // ランダムな6桁が偶然一致した場合は、別コードになるまで再発行する。
  if (t.code() === old) await t.send();
  expect(t.code()).not.toBe(old);
  expect((await t.reset(old)).status).toBe(400);
  await t.db.update(verification).set({ expiresAt: new Date(Date.now() - 1_000) });
  const expired = await t.reset();
  expect(await expired.json()).toMatchObject({ code: "OTP_EXPIRED" });
  await t.request("email-otp/send-verification-otp", { email, type: "email-verification" });
  expect((await t.reset()).status).toBe(400);
});

test("再設定コードの並列使用は一度だけ成功する", async () => {
  const t = await setup();
  await t.send();
  const responses = await Promise.all([t.reset(), t.reset()]);
  expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
});

test("再設定メールの送信と入力にIP単位の回数制限がある", async () => {
  const t = await setup();
  for (let i = 0; i < 5; i++) expect((await t.send()).status).toBe(200);
  expect((await t.send()).status).toBe(429);
  expect(t.mails).toHaveLength(5);
  for (let i = 0; i < 10; i++) await t.reset("123456", newPassword, "missing@example.com");
  expect((await t.reset()).status).toBe(429);
});

test("送信失敗を通知し、パスワードや内部の送信エラーを漏らさない", async () => {
  const t = await setup();
  t.fail();
  const response = await t.send();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body).toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
  expect(JSON.stringify(body)).not.toContain("private-provider-error");
  expect((await t.login(PASSWORD_RESET_USER.password)).status).toBe(200);
});

test("退会後はメールを送らず、退会前のコードでもパスワードを更新できない", async () => {
  const t = await setup();
  await t.send();
  const before = await t.db.select().from(account);
  await t.db.update(user).set({ withdrawnAt: new Date() });
  expect((await t.send()).status).toBe(200);
  expect(t.mails).toHaveLength(1);
  expect((await t.reset()).status).toBe(400);
  expect(await t.db.select().from(account)).toEqual(before);
  expect((await t.login(PASSWORD_RESET_USER.password)).status).toBe(403);
});

test("未確認アカウントは再設定コードで所有確認され、seedで繰り返し検証できる", async () => {
  const t = await setup();
  await t.db.update(user).set({ emailVerified: false });
  await t.send();
  expect((await t.reset()).status).toBe(200);
  expect((await t.login(newPassword)).status).toBe(200);
  await seedPasswordReset(t.db);
  expect((await t.login(PASSWORD_RESET_USER.password)).status).toBe(200);
  expect(await t.db.select().from(verification)).toHaveLength(0);
  expect((await t.db.select().from(rateLimit)).length).toBeGreaterThan(0);
});

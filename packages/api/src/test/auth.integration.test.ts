import { expect, test } from "bun:test";
import { createAuth, type VerificationMail } from "@ichiro/auth";
import { createRateLimiter } from "@ichiro/auth/rate-limit";
import { authRateLimit, user, verification } from "@ichiro/db/schema/auth";
import { eq } from "drizzle-orm";
import { callerFor, createTestDb, httpAppFor, sessionFor } from "./helpers";

const credentials = { email: "auth-test@example.com", password: "password123", name: "Auth Test" };
const config = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "local-auth-integration-test-secret-12345",
  CORS_ORIGIN: "http://localhost:8081",
};
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function setup() {
  const db = await createTestDb();
  const mails: VerificationMail[] = [];
  const sender = async (mail: VerificationMail) => {
    mails.push(mail);
  };
  let auth = createAuth(config, db, sender);
  const request = (path: string, body?: object, cookie = "", ip = "192.0.2.1") =>
    auth.handler(
      new Request(`${config.BETTER_AUTH_URL}/api/auth/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "expo-origin": "ichiro://",
          cookie,
          "cf-connecting-ip": ip,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const last = () => {
    const mail = mails.at(-1);
    if (!mail) throw new Error("mail missing");
    return mail;
  };
  const register = () => request("sign-up/email", credentials);
  const verify = (otp = last().otp, ip?: string) =>
    request("email-otp/verify-email", { email: credentials.email, otp }, "", ip);
  const clearLimits = () => db.delete(authRateLimit);
  return {
    db,
    mails,
    request,
    register,
    verify,
    last,
    clearLimits,
    restart: () => {
      auth = createAuth(config, db, sender);
    },
  };
}

test("登録時は未認証、6桁コードを確認した後だけログインできる", async () => {
  const t = await setup();
  const registered = await t.register();
  expect(registered.status).toBe(200);
  expect(await registered.json()).toMatchObject({ token: null });
  expect(t.mails).toHaveLength(1);
  expect(t.last().otp).toMatch(/^\d{6}$/);
  const [stored] = await t.db.select().from(verification);
  expect(stored!.value).not.toContain(t.last().otp);
  expect(stored!.expiresAt.getTime() - Date.now()).toBeWithin(295_000, 301_000);
  expect((await t.request("sign-in/email", credentials)).status).toBe(403);
  const code = t.last().otp;
  const verified = await t.verify();
  expect(verified.status).toBe(200);
  const cookie = cookies(verified);
  expect(cookie).not.toBe("");
  expect(await (await t.request("get-session", undefined, cookie)).json()).toMatchObject({
    user: { emailVerified: true },
  });
  expect((await t.verify(code)).status).toBe(400);
  expect((await t.request("sign-out", {}, cookie)).status).toBe(200);
  expect(await (await t.request("get-session", undefined, cookie)).json()).toBeNull();
  expect(
    (await t.request("sign-in/email", { ...credentials, password: "incorrect-password" })).status,
  ).toBe(401);
  expect((await t.request("sign-in/email", credentials)).status).toBe(200);
});

test("期限切れ・別アドレス・5回誤入力したコードを拒否する", async () => {
  const t = await setup();
  await t.register();
  expect(
    (await t.request("email-otp/verify-email", { email: "other@example.com", otp: t.last().otp }))
      .status,
  ).toBe(400);
  await t.db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) });
  expect((await t.verify()).status).toBe(400);
  await t.clearLimits();
  await t.request("email-otp/send-verification-otp", {
    email: credentials.email,
    type: "email-verification",
  });
  const wrong = t.last().otp === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) expect((await t.verify(wrong, `192.0.2.${i + 2}`)).status).toBe(400);
  expect((await t.verify()).status).toBe(403);
  expect((await t.request("sign-in/email", credentials)).status).toBe(403);
});

test("再送は全発行経路・別IP・再起動でも制限され、許可された再送で旧コードが使えなくなる", async () => {
  const t = await setup();
  await t.register();
  const old = t.last().otp;
  t.restart();
  const body = { email: credentials.email.toUpperCase(), type: "email-verification" };
  expect((await t.request("email-otp/send-verification-otp", body, "", "192.0.2.99")).status).toBe(
    429,
  );
  expect((await t.request("send-verification-email", { email: credentials.email })).status).toBe(
    429,
  );
  expect((await t.register()).status).toBe(429);
  expect(t.mails).toHaveLength(1);
  await t.clearLimits();
  expect((await t.request("email-otp/send-verification-otp", body)).status).toBe(200);
  expect(t.mails).toHaveLength(2);
  // 乱数が偶然一致する確率をテストの不安定性にしない。
  if (old !== t.last().otp) expect((await t.verify(old)).status).toBe(400);
  expect((await t.verify()).status).toBe(200);
});

test("同一コードの並列確認は一度だけ成功する", async () => {
  const t = await setup();
  await t.register();
  const responses = await Promise.all([t.verify(), t.verify()]);
  expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
});

test("OTP用途のすり替えと確認済みアカウントのOTPログインを拒否する", async () => {
  const t = await setup();
  await t.register();
  await t.verify();
  await t.clearLimits();
  for (const type of ["sign-in", "forget-password", "change-email"]) {
    expect(
      (await t.request("email-otp/send-verification-otp", { email: credentials.email, type }))
        .status,
    ).toBe(400);
  }
  expect(
    (await t.request("sign-in/email-otp", { email: credentials.email, otp: "123456" })).status,
  ).toBe(404);
  expect(
    (
      await t.request("email-otp/check-verification-otp", {
        email: credentials.email,
        type: "email-verification",
        otp: "123456",
      })
    ).status,
  ).toBe(404);
  await t.request("email-otp/send-verification-otp", {
    email: credentials.email,
    type: "email-verification",
  });
  expect((await t.verify()).status).toBe(400);
});

test("送信失敗でも未認証のままで、再送して登録を再開できる", async () => {
  const db = await createTestDb();
  const failed = createAuth(config, db, async () => {
    throw new Error("secret-provider-detail");
  });
  const response = await failed.handler(
    new Request(`${config.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "expo-origin": "ichiro://",
        "cf-connecting-ip": "192.0.2.1",
      },
      body: JSON.stringify(credentials),
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret-provider-detail");
  const [u] = await db.select().from(user);
  expect(u!.emailVerified).toBe(false);
  await db.delete(authRateLimit);
  let code = "";
  const recovered = createAuth(config, db, async (mail) => {
    code = mail.otp;
  });
  await recovered.api.sendVerificationOTP({
    body: { email: credentials.email, type: "email-verification" },
  });
  const verified = await recovered.api.verifyEmailOTP({
    body: { email: credentials.email, otp: code },
  });
  expect(verified.user.emailVerified).toBe(true);
});

test("既存の未認証セッションでも tRPC と保護HTTPを利用できない", async () => {
  const t = await setup();
  await t.register();
  const session = await sessionFor(t.db, credentials.email);
  await expect(
    callerFor(t.db, session).consumer.commitment.list({ today: "2026-09-30" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const app = httpAppFor(t.db, new Map([["legacy", session]]));
  const response = await app.request("/api/profile/avatar", {
    method: "DELETE",
    headers: { Cookie: "legacy" },
  });
  expect(response.status).toBe(403);
});

test("メール変更には現在・変更先の両方のコードが必要で完了まで旧アドレスを保つ", async () => {
  const t = await setup();
  await t.register();
  const cookie = cookies(await t.verify());
  const newEmail = "changed@example.com";
  expect(
    (await t.request("email-otp/change-email", { newEmail, otp: "123456" }, cookie)).status,
  ).toBe(400);
  await t.clearLimits();
  expect(
    (
      await t.request(
        "email-otp/send-verification-otp",
        { email: credentials.email, type: "email-verification" },
        cookie,
      )
    ).status,
  ).toBe(200);
  expect(
    (await t.request("email-otp/request-email-change", { newEmail, otp: t.last().otp }, cookie))
      .status,
  ).toBe(200);
  expect(t.last()).toMatchObject({ email: newEmail, type: "change-email" });
  expect((await t.db.select().from(user))[0]!.email).toBe(credentials.email);
  const code = t.last().otp;
  expect(
    (
      await t.request(
        "email-otp/change-email",
        { newEmail: "wrong@example.com", otp: code },
        cookie,
      )
    ).status,
  ).toBe(400);
  expect((await t.request("email-otp/change-email", { newEmail, otp: code }, cookie)).status).toBe(
    200,
  );
  expect((await t.db.select().from(user))[0]).toMatchObject({
    email: newEmail,
    emailVerified: true,
  });
  expect((await t.request("sign-in/email", credentials)).status).toBe(401);
  expect((await t.request("sign-in/email", { ...credentials, email: newEmail })).status).toBe(200);
});

test("回数制限のDB更新は並列でも上限を守り、期限後に解除される", async () => {
  const db = await createTestDb();
  const limit = createRateLimiter(db, config.BETTER_AUTH_SECRET);
  const results = await Promise.all(
    Array.from({ length: 10 }, () => limit.consume("test", { window: 60, max: 3 })),
  );
  expect(results.filter((r) => r.allowed)).toHaveLength(3);
  await db.update(authRateLimit).set({ expiresAt: Date.now() - 1 });
  expect((await limit.consume("test", { window: 60, max: 3 })).allowed).toBe(true);
});

test("別環境の DB と認証シークレットではセッションを共有しない", async () => {
  const t = await setup();
  await t.register();
  const cookie = cookies(await t.verify());
  const other = createAuth(
    { ...config, BETTER_AUTH_SECRET: "other-environment-secret-at-least-32-characters" },
    await createTestDb(),
    async () => {},
  );
  const response = await other.handler(
    new Request(`${config.BETTER_AUTH_URL}/api/auth/get-session`, { headers: { cookie } }),
  );
  expect(await response.json()).toBeNull();
});

test("メールの時間上限とログインのIP上限を超えると429になる", async () => {
  const t = await setup();
  await t.register();
  const limiter = createRateLimiter(t.db, config.BETTER_AUTH_SECRET);
  const minuteKey = await limiter.fingerprint(`mail:minute:${credentials.email}`);
  for (let i = 0; i < 4; i++) {
    await t.db.delete(authRateLimit).where(eq(authRateLimit.key, minuteKey));
    expect(
      (
        await t.request(
          "email-otp/send-verification-otp",
          { email: credentials.email, type: "email-verification" },
          "",
          `192.0.2.${20 + i}`,
        )
      ).status,
    ).toBe(200);
  }
  await t.db.delete(authRateLimit).where(eq(authRateLimit.key, minuteKey));
  expect(
    (
      await t.request(
        "email-otp/send-verification-otp",
        { email: credentials.email, type: "email-verification" },
        "",
        "192.0.2.80",
      )
    ).status,
  ).toBe(429);
  expect(t.mails).toHaveLength(5);
  await t.verify();
  await t.clearLimits();
  for (let i = 0; i < 10; i++)
    await t.request("sign-in/email", { ...credentials, password: "wrong-password" });
  t.restart();
  expect((await t.request("sign-in/email", credentials)).status).toBe(429);
  expect((await t.request("sign-in/email", credentials, "", "192.0.2.2")).status).toBe(200);
});

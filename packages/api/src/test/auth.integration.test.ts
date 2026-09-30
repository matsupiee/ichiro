import { expect, test } from "bun:test";
import { createAuth, type VerificationMail } from "@ichiro/auth";
import { rateLimit, user, verification } from "@ichiro/db/schema/auth";
import { sql } from "drizzle-orm";
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
  const clearLimits = () => db.delete(rateLimit);
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

test("再送は標準DBで同じIPのAPIごとに制限され、拒否された再送はコードを失効させない", async () => {
  const t = await setup();
  await t.register();
  const old = t.last().otp;
  const body = { email: credentials.email, type: "email-verification" };
  for (let i = 0; i < 5; i++) {
    // 標準OTPは createdAt 順で最新を選ぶため、メモリ上の再送も別ミリ秒にする。
    await Bun.sleep(2);
    expect((await t.request("email-otp/send-verification-otp", body)).status).toBe(200);
  }
  expect(t.mails).toHaveLength(6);
  const latest = t.last().otp;
  t.restart();
  const denied = await t.request("email-otp/send-verification-otp", body);
  expect(denied.status).toBe(429);
  expect(Number(denied.headers.get("X-Retry-After"))).toBeGreaterThan(0);
  expect(t.mails).toHaveLength(6);
  if (old !== latest) expect((await t.verify(old)).status).toBe(400);
  expect((await t.verify(latest)).status).toBe(200);
  // メールアドレス単位の独自制限はなく、別IPは別の枠になる。
  expect((await t.request("email-otp/send-verification-otp", body, "", "192.0.2.2")).status).toBe(
    200,
  );
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
  await db.delete(rateLimit);
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

test("メール変更は新アドレスだけにコードを送り、完了まで旧アドレスを保つ", async () => {
  const t = await setup();
  await t.register();
  const cookie = cookies(await t.verify());
  const newEmail = "changed@example.com";
  expect(
    (await t.request("email-otp/change-email", { newEmail, otp: "123456" }, cookie)).status,
  ).toBe(400);
  const before = t.mails.length;
  expect((await t.request("email-otp/request-email-change", { newEmail }, cookie)).status).toBe(
    200,
  );
  expect(t.mails.slice(before)).toHaveLength(1);
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

test("標準DBの回数制限は並列リクエストでも上限を守り、待機後に解除される", async () => {
  const t = await setup();
  const send = () =>
    t.request("email-otp/send-verification-otp", {
      email: "missing@example.com",
      type: "email-verification",
    });
  const results = await Promise.all(Array.from({ length: 12 }, send));
  expect(results.filter((r) => r.status === 200)).toHaveLength(5);
  expect(results.filter((r) => r.status === 429)).toHaveLength(7);
  const [row] = await t.db.select().from(rateLimit);
  expect(row).toMatchObject({ count: 5 });
  expect(row!.id).toBeTruthy();
  await t.db.update(rateLimit).set({ lastRequest: Date.now() - 61_000 });
  expect((await send()).status).toBe(200);
  expect((await t.db.select().from(rateLimit))[0]!.count).toBe(1);
  const tables = await t.db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table'`,
  );
  expect(tables.map((table) => table.name)).toContain("rate_limit");
  expect(tables.map((table) => table.name)).not.toContain("auth_rate_limit");
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

test("ログインは標準DBで同じIPから60秒に10回までに制限する", async () => {
  const t = await setup();
  await t.register();
  await t.verify();
  await t.clearLimits();
  for (let i = 0; i < 10; i++)
    expect(
      (await t.request("sign-in/email", { ...credentials, password: "wrong-password" })).status,
    ).toBe(401);
  t.restart();
  expect((await t.request("sign-in/email", credentials)).status).toBe(429);
  expect((await t.request("sign-in/email", credentials, "", "192.0.2.2")).status).toBe(200);
  await t.db.update(rateLimit).set({ lastRequest: Date.now() - 61_000 });
  expect((await t.request("sign-in/email", credentials)).status).toBe(200);
});

test("メール変更の送信・確定はログイン必須で、同じアドレスは拒否する", async () => {
  const t = await setup();
  const newEmail = "new@example.com";
  expect((await t.request("email-otp/request-email-change", { newEmail })).status).toBe(401);
  expect((await t.request("email-otp/change-email", { newEmail, otp: "123456" })).status).toBe(401);
  expect(t.mails).toHaveLength(0);
  await t.register();
  const cookie = cookies(await t.verify());
  expect(
    (await t.request("email-otp/request-email-change", { newEmail: credentials.email }, cookie))
      .status,
  ).toBe(400);
  expect(
    (await t.request("email-otp/request-email-change", { newEmail: "invalid" }, cookie)).status,
  ).toBe(400);
  expect(t.mails).toHaveLength(1);
});

test("メール変更の再送は新アドレスだけに届き、期限切れ・誤入力上限を守る", async () => {
  const t = await setup();
  await t.register();
  const cookie = cookies(await t.verify());
  const newEmail = "new@example.com";
  const send = () => t.request("email-otp/request-email-change", { newEmail }, cookie);
  const confirm = (otp: string) => t.request("email-otp/change-email", { newEmail, otp }, cookie);
  expect((await send()).status).toBe(200);
  await t.db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) });
  expect((await confirm(t.last().otp)).status).toBe(400);
  expect((await send()).status).toBe(200);
  const old = t.last().otp;
  await Bun.sleep(2);
  expect((await send()).status).toBe(200);
  const latest = t.last().otp;
  expect(
    t.mails.slice(1).every((mail) => mail.email === newEmail && mail.type === "change-email"),
  ).toBe(true);
  if (old !== latest) expect((await confirm(old)).status).toBe(400);
  expect((await confirm(latest)).status).toBe(200);
  expect((await confirm(latest)).status).toBe(400);
  const nextEmail = "next@example.com";
  expect(
    (await t.request("email-otp/request-email-change", { newEmail: nextEmail }, cookie)).status,
  ).toBe(200);
  const code = t.last().otp;
  const wrong = code === "000000" ? "111111" : "000000";
  await t.clearLimits();
  for (let i = 0; i < 5; i++)
    expect(
      (await t.request("email-otp/change-email", { newEmail: nextEmail, otp: wrong }, cookie))
        .status,
    ).toBe(400);
  expect(
    (await t.request("email-otp/change-email", { newEmail: nextEmail, otp: code }, cookie)).status,
  ).toBe(403);
  expect((await t.db.select().from(user))[0]!.email).toBe(newEmail);
});

test("退会は既存の全セッションを失効し、正しいパスワードでも永久にログインを拒否する", async () => {
  const t = await setup();
  await t.register();
  const verified = await t.verify();
  const cookie1 = cookies(verified);
  const login = await t.request("sign-in/email", credentials);
  const cookie2 = cookies(login);
  const caller = callerFor(t.db, await sessionFor(t.db, credentials.email));
  expect(await caller.consumer.account.withdraw({ acknowledged: true })).toEqual({
    status: "completed",
  });
  t.restart();
  for (const cookie of [cookie1, cookie2]) {
    expect(await (await t.request("get-session", undefined, cookie)).json()).toBeNull();
    expect((await t.request("update-user", { name: "Changed" }, cookie)).status).toBe(401);
  }
  await t.clearLimits();
  const denied = await t.request("sign-in/email", credentials);
  expect(denied.status).toBe(403);
  expect(await denied.json()).toMatchObject({ code: "ACCOUNT_WITHDRAWN" });
  const [stored] = await t.db.select().from(user);
  expect(stored).toMatchObject({ name: credentials.name, email: credentials.email });
});

for (const verified of [false, true]) {
  test(`登録済みメールは大小文字を問わず重複エラーになり既存情報を維持する（確認済み=${verified}）`, async () => {
    const t = await setup();
    await t.register();
    if (verified) await t.verify();
    const originalUser = (await t.db.select().from(user))[0];
    const originalCodes = await t.db.select().from(verification);
    for (const email of [credentials.email, credentials.email.toUpperCase()]) {
      const response = await t.request("sign-up/email", {
        email,
        name: "Replacement Name",
        password: "replacement-password",
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "登録済みのアカウントです。ログインしてください",
      });
      expect(cookies(response)).toBe("");
    }
    expect(await t.db.select().from(user)).toEqual([originalUser!]);
    expect(await t.db.select().from(verification)).toEqual(originalCodes);
    expect(t.mails).toHaveLength(1);
    expect(
      (await t.request("sign-in/email", { ...credentials, password: "replacement-password" }))
        .status,
    ).toBe(401);
    const login = await t.request("sign-in/email", credentials);
    expect(login.status).toBe(verified ? 200 : 403);
    if (!verified) {
      expect(await login.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
      expect((await t.verify()).status).toBe(200);
    }
  });
}

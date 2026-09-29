import { expect, test } from "bun:test";
import { createAuth } from "@ichiro/auth";

import { createTestDb } from "./helpers";

test("ネイティブアプリから新規登録・ログアウト・再ログインできる", async () => {
  const auth = createAuth(
    {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "local-auth-integration-test-secret-12345",
      CORS_ORIGIN: "http://localhost:8081",
    },
    await createTestDb(),
  );
  const credentials = { email: "auth-test@example.com", password: "password123" };
  const request = (path: string, body?: object, cookie = "") =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth/${path}`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", "expo-origin": "ichiro://", cookie },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

  const registered = await request("sign-up/email", { ...credentials, name: "Auth Test" });
  expect(registered.status).toBe(200);
  const cookie = cookies(registered);
  expect(cookie).not.toBe("");
  const session = await request("get-session", undefined, cookie);
  expect(await session.json()).toMatchObject({ user: { email: credentials.email } });

  expect((await request("sign-out", {}, cookie)).status).toBe(200);
  expect(await (await request("get-session", undefined, cookie)).json()).toBeNull();
  expect(
    (await request("sign-in/email", { ...credentials, password: "incorrect-password" })).status,
  ).toBe(401);

  const loggedIn = await request("sign-in/email", credentials);
  expect(loggedIn.status).toBe(200);
  const restored = await request("get-session", undefined, cookies(loggedIn));
  expect(await restored.json()).toMatchObject({ user: { email: credentials.email } });
});

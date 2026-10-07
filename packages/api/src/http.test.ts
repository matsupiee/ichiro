import { describe, expect, test } from "bun:test";

import { createHttpHandler, publicHttpRoute } from "./http";

// 振り分けだけを確かめる。Context は使わないので空の値を渡す
const handle = createHttpHandler(
  [
    publicHttpRoute("GET", "/avatars/:userId/:file", ({ params }) => Response.json(params)),
    publicHttpRoute("PUT", "/api/profile/avatar", () => new Response("put")),
  ],
  async () => ({}) as never,
);
const call = (path: string, method = "GET") =>
  handle(new Request(new URL(path, "http://localhost"), { method }));

describe("素の HTTP のルートの振り分け", () => {
  test("パスの「:名前」の値をデコードしてハンドラーに渡す", async () => {
    const res = await call("/avatars/user%201/a.jpg");
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ userId: "user 1", file: "a.jpg" });
  });

  test("メソッドが合うルートだけを実行する", async () => {
    expect(await (await call("/api/profile/avatar", "PUT")).text()).toBe("put");
    expect((await call("/api/profile/avatar", "POST")).status).toBe(404);
    expect((await call("/api/profile/avatar")).status).toBe(404);
  });

  test("区切りの数が違うパスや、空の値は 404 になる", async () => {
    expect((await call("/avatars/someone")).status).toBe(404);
    expect((await call("/avatars/someone/a.jpg/extra")).status).toBe(404);
    expect((await call("/avatars//a.jpg")).status).toBe(404);
  });

  test("HEAD は GET のルートで処理し、本文を返さない", async () => {
    const res = await call("/avatars/someone/a.jpg", "HEAD");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.text()).toBe("");
  });
});

import { describe, expect, test } from "bun:test";

import type { Session } from "@ichiro/auth";
import { user } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { createUser, httpAppFor, setupDemo } from "../../../../test/helpers";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const MAX_BYTES = 5 * 1024 * 1024;

async function setup() {
  const demo = await setupDemo();
  // Cookie ヘッダーの値でログイン中のユーザーを切り替える
  const sessions = new Map<string, Session>([["demo", demo.session]]);
  const app = httpAppFor(demo.db, sessions, { avatars: demo.avatars });

  const upload = (body: BodyInit, type: string, cookie = "demo") =>
    app.request("/api/profile/avatar", {
      method: "PUT",
      body,
      headers: { "Content-Type": type, Cookie: cookie },
    });
  const imageOf = async (userId: string) => {
    const [row] = await demo.db.select().from(user).where(eq(user.id, userId));
    return row?.image ?? null;
  };

  return { ...demo, app, objects: demo.avatars.objects, sessions, upload, imageOf };
}

describe("プロフィール写真をアップロードできる", () => {
  test("アップロードすると保存され、user.image のパスから同じ写真を取得できる", async () => {
    const { app, session, upload, imageOf, objects } = await setup();

    const res = await upload(JPEG, "image/jpeg");
    expect(res.status).toBe(200);
    const { image } = (await res.json()) as { image: string };
    expect(image).toMatch(new RegExp(`^/avatars/${session.user.id}/[a-z0-9]+\\.jpg$`));
    expect(await imageOf(session.user.id)).toBe(image);
    expect(objects.size).toBe(1);

    const got = await app.request(image);
    expect(got.status).toBe(200);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(JPEG);
  });

  test("PNG と WebP も受け付け、拡張子が形式に合う", async () => {
    const { upload } = await setup();
    const png = (await (await upload(PNG, "image/png")).json()) as { image: string };
    expect(png.image).toEndWith(".png");
    const webp = (await (await upload(WEBP, "image/webp")).json()) as { image: string };
    expect(webp.image).toEndWith(".webp");
  });

  test("写真を差し替えると、古い写真は消えて URL も変わる", async () => {
    const { app, upload, objects } = await setup();
    const first = (await (await upload(JPEG, "image/jpeg")).json()) as { image: string };
    const second = (await (await upload(PNG, "image/png")).json()) as { image: string };

    expect(second.image).not.toBe(first.image);
    expect(objects.size).toBe(1);
    expect((await app.request(first.image)).status).toBe(404);
    expect((await app.request(second.image)).status).toBe(200);
  });

  test("ログインしていないとアップロードできない", async () => {
    const { upload, objects } = await setup();
    const res = await upload(JPEG, "image/jpeg", "nobody");
    expect(res.status).toBe(401);
    expect(objects.size).toBe(0);
  });

  test("画像でないファイルは受け付けない", async () => {
    const { session, upload, imageOf, objects } = await setup();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");

    expect((await upload(html, "text/html")).status).toBe(415);
    // 形式を偽っても、中身が JPEG でなければ受け付けない
    expect((await upload(html, "image/jpeg")).status).toBe(415);
    expect((await upload(PNG, "image/jpeg")).status).toBe(415);
    expect(objects.size).toBe(0);
    expect(await imageOf(session.user.id)).toBeNull();
  });

  test("空のファイルは受け付けない", async () => {
    const { upload } = await setup();
    expect((await upload(new Uint8Array(), "image/jpeg")).status).toBe(400);
  });

  test("5MB を超える写真は受け付けない", async () => {
    const { upload, objects } = await setup();
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(JPEG);
    const res = await upload(big, "image/jpeg");
    expect(res.status).toBe(413);
    expect(((await res.json()) as { message: string }).message).toBe("写真は5MB以下にしてください");
    expect(objects.size).toBe(0);
  });

  test("ちょうど5MBの写真は受け付ける", async () => {
    const { upload } = await setup();
    const max = new Uint8Array(MAX_BYTES);
    max.set(JPEG);
    expect((await upload(max, "image/jpeg")).status).toBe(200);
  });

  test("ほかのユーザーの写真は変わらない", async () => {
    const { db, session, sessions, upload, imageOf } = await setup();
    const friend = await createUser(db, "friend@example.com");
    sessions.set("friend", friend);

    const mine = (await (await upload(JPEG, "image/jpeg")).json()) as { image: string };
    await upload(PNG, "image/png", "friend");

    expect(await imageOf(session.user.id)).toBe(mine.image);
    expect(await imageOf(friend.user.id)).toStartWith(`/avatars/${friend.user.id}/`);
  });
});

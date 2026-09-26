import { describe, expect, test } from "bun:test";

import type { Session } from "@ichiro/auth";
import { user } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { AVATAR_MAX_BYTES, avatarRoutes, memoryAvatarStorage } from "./avatar";
import { createUser, setupDemo } from "./test/helpers";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

async function setup() {
  const demo = await setupDemo();
  const { storage, objects } = memoryAvatarStorage();
  // Cookie ヘッダーの値でログイン中のユーザーを切り替える
  const sessions = new Map<string, Session>([["demo", demo.session]]);
  const app = avatarRoutes(() => ({
    db: demo.db,
    storage,
    getSession: async (headers) => sessions.get(headers.get("Cookie") ?? "") ?? null,
  }));

  const upload = (body: BodyInit, type: string, cookie = "demo") =>
    app.request("/api/profile/avatar", {
      method: "PUT",
      body,
      headers: { "Content-Type": type, Cookie: cookie },
    });
  const remove = (cookie = "demo") =>
    app.request("/api/profile/avatar", { method: "DELETE", headers: { Cookie: cookie } });
  const imageOf = async (userId: string) => {
    const [row] = await demo.db.select().from(user).where(eq(user.id, userId));
    return row?.image ?? null;
  };

  return { ...demo, app, objects, sessions, upload, remove, imageOf };
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
    expect(got.headers.get("Content-Type")).toBe("image/jpeg");
    expect(got.headers.get("Cache-Control")).toContain("immutable");
    expect(got.headers.get("X-Content-Type-Options")).toBe("nosniff");
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
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(JPEG);
    const res = await upload(big, "image/jpeg");
    expect(res.status).toBe(413);
    expect(((await res.json()) as { message: string }).message).toBe("写真は5MB以下にしてください");
    expect(objects.size).toBe(0);
  });

  test("ちょうど5MBの写真は受け付ける", async () => {
    const { upload } = await setup();
    const max = new Uint8Array(AVATAR_MAX_BYTES);
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

describe("プロフィール写真を削除できる", () => {
  test("削除すると user.image が空になり、写真も消える", async () => {
    const { app, session, upload, remove, imageOf, objects } = await setup();
    const { image } = (await (await upload(JPEG, "image/jpeg")).json()) as { image: string };

    const res = await remove();
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ image: null });
    expect(await imageOf(session.user.id)).toBeNull();
    expect(objects.size).toBe(0);
    expect((await app.request(image)).status).toBe(404);
  });

  test("写真がなくても削除できる", async () => {
    const { remove } = await setup();
    expect((await remove()).status).toBe(200);
  });

  test("外部の URL の写真は、user.image だけ空にしてストレージには触れない", async () => {
    const { db, session, remove, imageOf, objects } = await setup();
    objects.set("avatars/other/keep.jpg", { bytes: JPEG, contentType: "image/jpeg" });
    await db
      .update(user)
      .set({ image: "https://example.com/me.jpg" })
      .where(eq(user.id, session.user.id));

    await remove();
    expect(await imageOf(session.user.id)).toBeNull();
    expect(objects.size).toBe(1);
  });

  test("ログインしていないと削除できない", async () => {
    const { remove } = await setup();
    expect((await remove("nobody")).status).toBe(401);
  });
});

describe("プロフィール写真を配信する", () => {
  test("ない写真は 404 になる", async () => {
    const { app } = await setup();
    expect((await app.request("/avatars/someone/missing.jpg")).status).toBe(404);
  });
});

import { describe, expect, test } from "bun:test";

import type { Session } from "@ichiro/auth";
import { user } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { httpAppFor, setupDemo } from "../../../../test/helpers";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

async function setup() {
  const demo = await setupDemo();
  const sessions = new Map<string, Session>([["demo", demo.session]]);
  const app = httpAppFor(demo.db, sessions, { avatars: demo.avatars });

  const upload = async () => {
    const res = await app.request("/api/profile/avatar", {
      method: "PUT",
      body: JPEG,
      headers: { "Content-Type": "image/jpeg", Cookie: "demo" },
    });
    return ((await res.json()) as { image: string }).image;
  };
  const remove = (cookie = "demo") =>
    app.request("/api/profile/avatar", { method: "DELETE", headers: { Cookie: cookie } });
  const imageOf = async (userId: string) => {
    const [row] = await demo.db.select().from(user).where(eq(user.id, userId));
    return row?.image ?? null;
  };

  return { ...demo, app, objects: demo.avatars.objects, upload, remove, imageOf };
}

describe("プロフィール写真を削除できる", () => {
  test("削除すると user.image が空になり、写真も消える", async () => {
    const { app, session, upload, remove, imageOf, objects } = await setup();
    const image = await upload();

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

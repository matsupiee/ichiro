import { describe, expect, test } from "bun:test";

import { httpAppFor, setupDemo } from "../../../../test/helpers";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

describe("プロフィール写真を配信する", () => {
  test("ログインしていなくても、置かれた写真を画像として長くキャッシュできる形で返す", async () => {
    const { db, avatars } = await setupDemo();
    avatars.objects.set("avatars/someone/abc.jpg", { bytes: JPEG, contentType: "image/jpeg" });
    const app = httpAppFor(db, new Map(), { avatars });

    const res = await app.request("/avatars/someone/abc.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("ETag")).toBe('"avatars/someone/abc.jpg"');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  test("ない写真は 404 になる", async () => {
    const { db, avatars } = await setupDemo();
    const app = httpAppFor(db, new Map(), { avatars });
    expect((await app.request("/avatars/someone/missing.jpg")).status).toBe(404);
  });
});

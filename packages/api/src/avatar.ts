import type { Session } from "@ichiro/auth";
import type { Database } from "@ichiro/db";
import { user } from "@ichiro/db/schema/index";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

// プロフィール写真のアップロード・削除・配信。
// 画像のバイナリを tRPC の JSON に載せると重いので、ここだけ素の HTTP で受ける。

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

// Cloudflare R2 のバケットのうち、ここで使う部分だけ。テストではメモリ上の実装を渡す。
export type AvatarObject = {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
};

export type AvatarStorage = {
  put(
    key: string,
    value: ArrayBuffer,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<AvatarObject | null>;
  delete(key: string): Promise<void>;
};

export type AvatarDeps = {
  db: Database;
  storage: AvatarStorage;
  getSession: (headers: Headers) => Promise<Session | null>;
};

// 宣言された形式と中身の先頭バイトが一致するものだけ受け付ける。
// 配信時にこの Content-Type をそのまま返すので、画像以外を画像として配らないようにする。
const FORMATS = {
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  // RIFF....WEBP
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]], at8: [0x57, 0x45, 0x42, 0x50] },
} as const;

type Format = keyof typeof FORMATS;

function detectFormat(contentType: string | undefined, bytes: Uint8Array): Format | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  if (!type || !(type in FORMATS)) return null;
  const format = FORMATS[type as Format];
  const startsWith = (sig: readonly number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  if (!format.magic.some((sig) => startsWith(sig))) return null;
  if ("at8" in format && !startsWith(format.at8, 8)) return null;
  return type as Format;
}

// user.image にはサーバーからの相対パスを入れる。アプリは API の URL につなげて表示する。
const pathOf = (key: string) => `/${key}`;
const ownPrefix = (userId: string) => `/avatars/${userId}/`;

async function currentImage(db: Database, userId: string) {
  const [row] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
  return row?.image ?? null;
}

async function deleteOwned(storage: AvatarStorage, userId: string, image: string | null) {
  // 外部の URL（将来のソーシャルログインなど）は消さない
  if (!image?.startsWith(ownPrefix(userId))) return;
  await storage.delete(image.slice(1));
}

export function avatarRoutes(deps: (headers: Headers) => AvatarDeps | Promise<AvatarDeps>) {
  const app = new Hono();

  app.put("/api/profile/avatar", async (c) => {
    const { db, storage, getSession } = await deps(c.req.raw.headers);
    const session = await getSession(c.req.raw.headers);
    if (!session) return c.json({ message: "ログインしてください" }, 401);

    const declared = Number(c.req.header("Content-Length"));
    if (declared > AVATAR_MAX_BYTES) {
      return c.json({ message: "写真は5MB以下にしてください" }, 413);
    }
    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) {
      return c.json({ message: "写真を選んでください" }, 400);
    }
    if (body.byteLength > AVATAR_MAX_BYTES) {
      return c.json({ message: "写真は5MB以下にしてください" }, 413);
    }
    const format = detectFormat(c.req.header("Content-Type"), new Uint8Array(body.slice(0, 16)));
    if (!format) {
      return c.json({ message: "JPEG・PNG・WebP の写真を選んでください" }, 415);
    }

    const userId = session.user.id;
    const previous = await currentImage(db, userId);
    const key = `avatars/${userId}/${createId()}.${FORMATS[format].ext}`;
    await storage.put(key, body, { httpMetadata: { contentType: format } });
    const image = pathOf(key);
    await db.update(user).set({ image }).where(eq(user.id, userId));
    // 新しい写真に切り替えてから古い写真を消す。途中で失敗しても写真が消えた状態にはならない
    await deleteOwned(storage, userId, previous);

    return c.json({ image });
  });

  app.delete("/api/profile/avatar", async (c) => {
    const { db, storage, getSession } = await deps(c.req.raw.headers);
    const session = await getSession(c.req.raw.headers);
    if (!session) return c.json({ message: "ログインしてください" }, 401);

    const userId = session.user.id;
    const previous = await currentImage(db, userId);
    await db.update(user).set({ image: null }).where(eq(user.id, userId));
    await deleteOwned(storage, userId, previous);

    return c.json({ image: null });
  });

  // 写真は友達にも見せるので、ログインなしで読める。キーは推測できない ID を含み、差し替えるたびに変わる
  app.get("/avatars/:userId/:file", async (c) => {
    const { storage } = await deps(c.req.raw.headers);
    const object = await storage.get(`avatars/${c.req.param("userId")}/${c.req.param("file")}`);
    if (!object) return c.notFound();

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ETag: object.httpEtag,
      },
    });
  });

  return app;
}

// テストとローカル開発用のメモリ上のストレージ
export function memoryAvatarStorage() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const storage: AvatarStorage = {
    async put(key, value, options) {
      objects.set(key, {
        bytes: new Uint8Array(value.slice(0)),
        contentType: options.httpMetadata.contentType,
      });
      return null;
    },
    async get(key) {
      const o = objects.get(key);
      if (!o) return null;
      return {
        body: new Blob([o.bytes]).stream(),
        httpEtag: `"${key}"`,
        httpMetadata: { contentType: o.contentType },
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return { storage, objects };
}

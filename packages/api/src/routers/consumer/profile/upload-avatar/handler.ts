import { user } from "@ichiro/db/schema/index";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { deleteOwnAvatar } from "../../../../shared/avatar/delete-own-avatar";
import type { profileUploadAvatarInputSchema, profileUploadAvatarOutputSchema } from "./route";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type Format = z.infer<typeof profileUploadAvatarInputSchema>["contentType"];

// 宣言された形式と中身の先頭バイトが一致するものだけ受け付ける。
// 配信時にこの Content-Type をそのまま返すので、画像以外を画像として配らないようにする
const FORMATS: Record<Format, { ext: string; magic: number[]; at8?: number[] }> = {
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // RIFF....WEBP
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46], at8: [0x57, 0x45, 0x42, 0x50] },
};

function detectFormat(contentType: string | undefined, bytes: Uint8Array): Format | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  if (!type || !(type in FORMATS)) return null;
  const format = FORMATS[type as Format];
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (!startsWith(format.magic)) return null;
  if (format.at8 && !startsWith(format.at8, 8)) return null;
  return type as Format;
}

export async function handler({ request, context }: { request: Request; context: AuthedContext }) {
  const declared = Number(request.headers.get("Content-Length"));
  if (declared > AVATAR_MAX_BYTES) {
    return Response.json({ message: "写真は5MB以下にしてください" }, { status: 413 });
  }
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ message: "写真を選んでください" }, { status: 400 });
  }
  if (body.byteLength > AVATAR_MAX_BYTES) {
    return Response.json({ message: "写真は5MB以下にしてください" }, { status: 413 });
  }
  const format = detectFormat(
    request.headers.get("Content-Type") ?? undefined,
    new Uint8Array(body.slice(0, 16)),
  );
  if (!format) {
    return Response.json({ message: "JPEG・PNG・WebP の写真を選んでください" }, { status: 415 });
  }

  const userId = context.session.user.id;
  const [current] = await context.db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId));
  const key = `avatars/${userId}/${createId()}.${FORMATS[format].ext}`;
  await context.avatarStorage.put(key, body, { httpMetadata: { contentType: format } });
  // user.image にはサーバーからの相対パスを入れる。アプリは API の URL につなげて表示する
  const image = `/${key}`;
  await context.db.update(user).set({ image }).where(eq(user.id, userId));
  // 新しい写真に切り替えてから古い写真を消す。途中で失敗しても写真が消えた状態にはならない
  await deleteOwnAvatar(context.avatarStorage, userId, current?.image ?? null);

  return Response.json({ image } satisfies z.infer<typeof profileUploadAvatarOutputSchema>);
}

import type z from "zod";

import type { Context } from "../../../../context";
import { notFound, type HttpParams } from "../../../../http";
import type { profileGetAvatarInputSchema } from "./route";

export async function handler({
  params,
  context,
}: {
  params: HttpParams;
  context: Omit<Context, "session">;
}) {
  const { userId, file } = params as z.infer<typeof profileGetAvatarInputSchema>;
  const object = await context.avatarStorage.get(`avatars/${userId}/${file}`);
  if (!object) return notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: object.httpEtag,
    },
  });
}

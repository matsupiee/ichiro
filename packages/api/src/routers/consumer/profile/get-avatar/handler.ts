import type { Context as HonoContext } from "hono";
import type z from "zod";

import type { Context } from "../../../../context";
import type { profileGetAvatarInputSchema } from "./route";

export async function handler({
  c,
  context,
}: {
  c: HonoContext;
  context: Omit<Context, "session">;
}) {
  const { userId, file } = c.req.param() as z.infer<typeof profileGetAvatarInputSchema>;
  const object = await context.avatarStorage.get(`avatars/${userId}/${file}`);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: object.httpEtag,
    },
  });
}

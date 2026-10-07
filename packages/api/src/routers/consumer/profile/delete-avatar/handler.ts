import { user } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { deleteOwnAvatar } from "../../../../shared/avatar/delete-own-avatar";
import type { profileDeleteAvatarOutputSchema } from "./route";

export async function handler({ context }: { context: AuthedContext }) {
  const userId = context.session.user.id;
  const [current] = await context.db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId));
  await context.db.update(user).set({ image: null }).where(eq(user.id, userId));
  await deleteOwnAvatar(context.avatarStorage, userId, current?.image ?? null);

  return Response.json({ image: null } satisfies z.infer<typeof profileDeleteAvatarOutputSchema>);
}

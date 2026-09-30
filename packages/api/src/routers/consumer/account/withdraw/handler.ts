import { user, session } from "@ichiro/db/schema/auth";
import { eq, sql } from "drizzle-orm";
import type { AuthedContext } from "../../../../context";

export async function handler({ ctx }: { ctx: AuthedContext }) {
  const id = ctx.session.user.id;
  // 退会日時と全端末のセッション失効を同一トランザクションで確定する。
  await ctx.db.batch([
    ctx.db
      .update(user)
      .set({ withdrawnAt: sql`coalesce(${user.withdrawnAt}, ${Date.now()})` })
      .where(eq(user.id, id)),
    ctx.db.delete(session).where(eq(session.userId, id)),
  ]);
  return { status: "completed" as const };
}

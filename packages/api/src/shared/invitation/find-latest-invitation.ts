import type { Database } from "@ichiro/db";
import type { commitment } from "@ichiro/db/schema/commitment";
import { invitation } from "@ichiro/db/schema/invitation";
import { and, desc, eq, sql } from "drizzle-orm";

// いまの友達のメールアドレスに最後に送った招待。友達にチェックしてもらわないなら null
export async function findLatestInvitation(db: Database, row: typeof commitment.$inferSelect) {
  if (row.checker !== "friend" || !row.friendEmail) return null;
  const [latest] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.commitmentId, row.id), eq(invitation.email, row.friendEmail)))
    // 同じミリ秒に送ったものは、あとから入れた行を先にする
    .orderBy(desc(invitation.createdAt), desc(sql`rowid`))
    .limit(1);
  return latest ?? null;
}

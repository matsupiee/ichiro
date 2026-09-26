import { commitment } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import type { AuthedContext } from "../../context";

// ログイン中のユーザーのコミットメントを返す。ほかのユーザーのものは、ないものとして扱う
export async function findOwnCommitment(
  context: Pick<AuthedContext, "db" | "session">,
  id: string,
) {
  const [row] = await context.db
    .select()
    .from(commitment)
    .where(and(eq(commitment.id, id), eq(commitment.userId, context.session.user.id)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "コミットメントが見つかりません" });
  }
  return row;
}

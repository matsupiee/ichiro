import { commitment } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, eq, ne, sql } from "drizzle-orm";
import type z from "zod";
import type { AuthedContext } from "../../../../context";
import { findOwnCommitment } from "../../../../shared/commitment/find-own-commitment";
import type { commitmentSetCheckerInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentSetCheckerInputSchema>;
}) {
  await findOwnCommitment(ctx, input.id);
  const selection = input.selection;
  if (selection.mode === "friend") {
    const [known] = await ctx.db
      .select({ id: commitment.id })
      .from(commitment)
      .where(
        and(
          eq(commitment.userId, ctx.session.user.id),
          ne(commitment.id, input.id),
          eq(commitment.checkerUserId, selection.userId),
          eq(commitment.checker, "friend"),
        ),
      )
      .limit(1);
    if (!known || selection.userId === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "ほかのコミットメントで依頼している友達を選んでください",
      });
    }
  }
  const [row] = await ctx.db
    .update(commitment)
    .set(
      selection.mode === "link"
        ? // 再共有は同じ未承認リンクを使う。承認されるまでは今のチェック者を保つ
          { shareToken: sql`coalesce(${commitment.shareToken}, ${crypto.randomUUID()})` }
        : {
            checker: selection.mode === "self" ? "self" : "friend",
            checkerUserId: selection.mode === "friend" ? selection.userId : null,
            shareToken: null,
          },
    )
    .where(and(eq(commitment.id, input.id), eq(commitment.userId, ctx.session.user.id)))
    .returning();
  return row!;
}

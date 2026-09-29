import { commitment } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import type z from "zod";
import type { AuthedContext } from "../../../../context";
import type { commitmentAcceptInvitationInputSchema } from "./route";
export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentAcceptInvitationInputSchema>;
}) {
  // 条件つきの1回の更新で、同時承認・無効化との競合でも一人だけが引き受けられる
  const [row] = await ctx.db
    .update(commitment)
    .set({ checker: "friend", checkerUserId: ctx.session.user.id, shareToken: null })
    .where(and(eq(commitment.shareToken, input.token), ne(commitment.userId, ctx.session.user.id)))
    .returning({ goal: commitment.goal });
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "この依頼リンクは利用できません。自分の依頼は引き受けられません",
    });
  return row;
}

import { commitment, user } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type z from "zod";
import type { AuthedContext } from "../../../../context";
import type { commitmentGetInvitationInputSchema } from "./route";
export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentGetInvitationInputSchema>;
}) {
  const [row] = await ctx.db
    .select({
      ownerName: user.name,
      ownerId: user.id,
      goal: commitment.goal,
      content: commitment.content,
      untilDate: commitment.untilDate,
    })
    .from(commitment)
    .innerJoin(user, eq(commitment.userId, user.id))
    .where(eq(commitment.shareToken, input.token));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "この依頼リンクは利用できません" });
  return { ...row, isOwn: row.ownerId === ctx.session.user.id };
}

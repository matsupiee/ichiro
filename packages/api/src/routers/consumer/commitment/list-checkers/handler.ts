import { commitment, user } from "@ichiro/db/schema/index";
import { and, eq, ne } from "drizzle-orm";
import type z from "zod";
import type { AuthedContext } from "../../../../context";
import { findOwnCommitment } from "../../../../shared/commitment/find-own-commitment";
import type { commitmentListCheckersInputSchema } from "./route";
export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentListCheckersInputSchema>;
}) {
  await findOwnCommitment(ctx, input.id);
  return ctx.db
    .selectDistinct({ id: user.id, name: user.name, image: user.image })
    .from(commitment)
    .innerJoin(user, eq(commitment.checkerUserId, user.id))
    .where(
      and(
        eq(commitment.userId, ctx.session.user.id),
        ne(commitment.id, input.id),
        eq(commitment.checker, "friend"),
        ne(user.id, ctx.session.user.id),
      ),
    )
    .orderBy(user.name, user.id);
}

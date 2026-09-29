import { commitment } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { assertCommitmentValuesAllowed } from "../../../../shared/commitment/assert-commitment-values-allowed";
import { normalizeCommitmentValues } from "../../../../shared/commitment/normalize-commitment-values";
import { addDays } from "../../../../shared/date/add-days";
import type { commitmentCreateInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentCreateInputSchema>;
}) {
  if (input.values.untilDate < input.today) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "終了日は今日以降にしてください" });
  }
  await assertCommitmentValuesAllowed(ctx, input.values);

  const [row] = await ctx.db
    .insert(commitment)
    .values({
      ...normalizeCommitmentValues(input.values),
      userId: ctx.session.user.id,
      checker: "self",
      startDate: input.today,
      timeZone: input.timeZone,
      // 今日の分から精算の対象にする
      settledThrough: addDays(input.today, -1),
    })
    .returning();
  return row!;
}

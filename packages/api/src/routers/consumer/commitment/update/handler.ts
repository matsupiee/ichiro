import { commitment } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { assertCommitmentValuesAllowed } from "../../../../shared/commitment/assert-commitment-values-allowed";
import { findOwnCommitment } from "../../../../shared/commitment/find-own-commitment";
import { normalizeCommitmentValues } from "../../../../shared/commitment/normalize-commitment-values";
import { addDays } from "../../../../shared/date/add-days";
import { todayIn } from "../../../../shared/date/today-in";
import { sendInvitation } from "../../../../shared/invitation/send-invitation";
import { settleCommitment } from "../../../../shared/penalty/settle-commitment";
import type { commitmentUpdateInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentUpdateInputSchema>;
}) {
  const current = await findOwnCommitment(ctx, input.id);
  if (input.values.untilDate < current.startDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "終了日は開始日以降にしてください" });
  }
  await assertCommitmentValuesAllowed(ctx, input.values);

  // 締め切りを過ぎた分は変更前の設定で精算し、新しい設定は今日の分から使う。
  // 金額を上げたり終了日を延ばしたりしても、過去の分にはさかのぼらない
  const settled = await settleCommitment(ctx.db, current);
  const timeZone = input.timeZone ?? current.timeZone;
  const yesterday = addDays(todayIn(timeZone), -1);
  const [row] = await ctx.db
    .update(commitment)
    .set({
      ...normalizeCommitmentValues(input.values),
      timeZone,
      settledThrough:
        settled.settledThrough !== null && settled.settledThrough > yesterday
          ? settled.settledThrough
          : yesterday,
    })
    .where(eq(commitment.id, current.id))
    .returning();

  const friendChanged =
    row!.checker === "friend" &&
    (current.checker !== "friend" || current.friendEmail !== row!.friendEmail);
  const invitation = friendChanged ? await sendInvitation(ctx, row!) : null;
  return { ...row!, invitation };
}

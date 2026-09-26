import { report } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { findOwnCommitment } from "../../../../shared/commitment/find-own-commitment";
import { settleCommitment } from "../../../../shared/penalty/settle-commitment";
import { computeStreak } from "../../../../shared/schedule/compute-streak";
import { isScheduled } from "../../../../shared/schedule/is-scheduled";
import type { commitmentReportInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentReportInputSchema>;
}) {
  const row = await findOwnCommitment(ctx, input.id);
  if (!isScheduled(row, input.today)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "今日は報告日ではありません" });
  }
  // 精算ずみの日は締め切りを過ぎている。あとから報告して罰金を逃れることはできない
  const { settledThrough } = await settleCommitment(ctx.db, row);
  if (settledThrough !== null && input.today <= settledThrough) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "締め切りを過ぎたため報告できません" });
  }

  const inserted = await ctx.db
    .insert(report)
    .values({ commitmentId: row.id, reportDate: input.today })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    throw new TRPCError({ code: "CONFLICT", message: "今日はもう報告ずみです" });
  }

  const reports = await ctx.db
    .select({ reportDate: report.reportDate })
    .from(report)
    .where(eq(report.commitmentId, row.id));
  return { streak: computeStreak(row, new Set(reports.map((r) => r.reportDate)), input.today) };
}

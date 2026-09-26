import { commitment, report } from "@ichiro/db/schema/index";
import { desc, eq, inArray, sql } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { computeStreak } from "../../../../shared/schedule/compute-streak";
import { isScheduled } from "../../../../shared/schedule/is-scheduled";
import type { commitmentListInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentListInputSchema>;
}) {
  const rows = await ctx.db
    .select()
    .from(commitment)
    .where(eq(commitment.userId, ctx.session.user.id))
    // 同じミリ秒に作られたものは、あとから入れた行を先にする
    .orderBy(desc(commitment.createdAt), desc(sql`rowid`));

  const reported = new Map<string, Set<string>>(rows.map((r) => [r.id, new Set()]));
  if (rows.length > 0) {
    const reports = await ctx.db
      .select({ commitmentId: report.commitmentId, reportDate: report.reportDate })
      .from(report)
      .where(
        inArray(
          report.commitmentId,
          rows.map((r) => r.id),
        ),
      );
    for (const r of reports) reported.get(r.commitmentId)?.add(r.reportDate);
  }

  return rows.map((row) => {
    const dates = reported.get(row.id)!;
    return {
      ...row,
      dueToday: isScheduled(row, input.today),
      reportedToday: dates.has(input.today),
      streak: computeStreak(row, dates, input.today),
    };
  });
}

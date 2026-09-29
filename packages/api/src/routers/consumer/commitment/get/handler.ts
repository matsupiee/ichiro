import { penalty, report, user } from "@ichiro/db/schema/index";
import { desc, eq } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { findOwnCommitment } from "../../../../shared/commitment/find-own-commitment";
import { addDays } from "../../../../shared/date/add-days";
import { settleCommitment } from "../../../../shared/penalty/settle-commitment";
import { computeStreak } from "../../../../shared/schedule/compute-streak";
import { isScheduled } from "../../../../shared/schedule/is-scheduled";
import type { commitmentGetInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentGetInputSchema>;
}) {
  const row = await findOwnCommitment(ctx, input.id);
  // cron を待たずに、締め切りを過ぎた分の罰金を履歴に出す
  const { settledThrough } = await settleCommitment(ctx.db, row);

  const reports = await ctx.db
    .select({ reportDate: report.reportDate })
    .from(report)
    .where(eq(report.commitmentId, row.id));
  const reported = new Set(reports.map((r) => r.reportDate));

  const penalties = await ctx.db
    .select({
      id: penalty.id,
      dueDate: penalty.dueDate,
      amount: penalty.amount,
      status: penalty.status,
      failureMessage: penalty.failureMessage,
      paidAt: penalty.paidAt,
    })
    .from(penalty)
    .where(eq(penalty.commitmentId, row.id))
    .orderBy(desc(penalty.dueDate));

  const [checkerUser] = row.checkerUserId
    ? await ctx.db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, row.checkerUserId))
    : [];
  return {
    ...row,
    checkerUser: checkerUser ?? null,
    settledThrough,
    dueToday: isScheduled(row, input.today),
    reportedToday: reported.has(input.today),
    streak: computeStreak(row, reported, input.today),
    week: weekOf(reported, input.today),
    penalties,
    // 徴収できなかったもの（failed）も、支払うべき罰金として合計に入れる
    penaltyTotal: penalties.reduce((sum, p) => sum + p.amount, 0),
  };
}

// 今日を含む週（月曜はじまり）の7日分について、報告したかどうか
function weekOf(reported: Set<string>, today: string) {
  const offset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, reported: reported.has(date) };
  });
}

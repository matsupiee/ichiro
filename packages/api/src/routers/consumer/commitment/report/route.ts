import z from "zod";

import { isPlausibleToday } from "../../../../shared/date/is-plausible-today";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentReportInputSchema = z.object({
  id: z.string(),
  // 端末の現地日付。この日の達成として記録する
  today: z.string().refine((d) => isPlausibleToday(d), "今日の日付が正しくありません"),
});

export const commitmentReportOutputSchema = z.object({
  // 報告したあとの連続達成
  streak: z.number(),
});

// 今日の達成を報告する。締め切りを過ぎた日には報告できない
export const commitmentReportRoute = protectedProcedure
  .input(commitmentReportInputSchema)
  .output(commitmentReportOutputSchema)
  .mutation(handler);

import { commitmentFrequencies } from "@ichiro/db/schema/commitment";
import z from "zod";

import { isPlausibleToday } from "../../../../shared/date/is-plausible-today";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentListInputSchema = z.object({
  // 端末の現地日付
  today: z.string().refine((d) => isPlausibleToday(d), "今日の日付が正しくありません"),
});

export const commitmentListOutputSchema = z.array(
  z.object({
    id: z.string(),
    content: z.string(),
    frequency: z.enum(commitmentFrequencies),
    weekdays: z.array(z.number()),
    monthDays: z.array(z.number()),
    startDate: z.string(),
    untilDate: z.string(),
    penaltyAmount: z.number().nullable(),
    paymentMethodId: z.string().nullable(),
    dueToday: z.boolean(),
    reportedToday: z.boolean(),
    streak: z.number(),
  }),
);

// メインページに並べる自分のコミットメント。新しい順
export const commitmentListRoute = protectedProcedure
  .input(commitmentListInputSchema)
  .output(commitmentListOutputSchema)
  .query(handler);

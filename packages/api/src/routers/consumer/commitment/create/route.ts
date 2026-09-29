import { checkers, commitmentFrequencies } from "@ichiro/db/schema/commitment";
import z from "zod";

import { validateCommitmentValues } from "../../../../shared/commitment/validate-commitment-values";
import { isPlausibleToday } from "../../../../shared/date/is-plausible-today";
import { isValidDate } from "../../../../shared/date/is-valid-date";
import { isValidTimeZone } from "../../../../shared/date/is-valid-time-zone";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentCreateInputSchema = z.object({
  // 端末の現地日付。この日が開始日になる
  today: z.string().refine((d) => isPlausibleToday(d), "今日の日付が正しくありません"),
  // 端末のタイムゾーン（IANA 名）。罰金の締め切りの判定に使う
  timeZone: z.string().refine(isValidTimeZone, "タイムゾーンが正しくありません").optional(),
  values: z
    .object({
      goal: z.string().trim().min(1, "目標を入力してください").max(60),
      content: z.string().trim().min(1, "コミット内容を入力してください").max(200),
      frequency: z.enum(commitmentFrequencies),
      weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      monthDays: z.array(z.number().int().min(1).max(31)).max(31),
      untilDate: z.string().refine(isValidDate, "日付の形式が正しくありません"),
      penaltyAmount: z.number().int().nullable(),
      // consumer.payment.listMethods で返す支払い方法の ID
      paymentMethodId: z.string().nullable(),
    })
    .superRefine((v, ctx) => {
      for (const issue of validateCommitmentValues(v)) {
        ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
      }
    }),
});

export const commitmentCreateOutputSchema = z.object({
  id: z.string(),
  goal: z.string(),
  content: z.string(),
  frequency: z.enum(commitmentFrequencies),
  weekdays: z.array(z.number()),
  monthDays: z.array(z.number()),
  startDate: z.string(),
  untilDate: z.string(),
  penaltyAmount: z.number().nullable(),
  paymentMethodId: z.string().nullable(),
  checker: z.enum(checkers),
  timeZone: z.string(),
  settledThrough: z.string().nullable(),
  shareToken: z.string().nullable(),
});

// コミットメントを作る
export const commitmentCreateRoute = protectedProcedure
  .input(commitmentCreateInputSchema)
  .output(commitmentCreateOutputSchema)
  .mutation(handler);

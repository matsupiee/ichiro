import { commitmentFrequencies } from "@ichiro/db/schema/commitment";
import z from "zod";

import { validateCommitmentValues } from "../../../../shared/commitment/validate-commitment-values";
import { isValidDate } from "../../../../shared/date/is-valid-date";
import { isValidTimeZone } from "../../../../shared/date/is-valid-time-zone";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentUpdateInputSchema = z.object({
  id: z.string(),
  // 端末のタイムゾーン（IANA 名）。罰金の締め切りの判定に使う
  timeZone: z.string().refine(isValidTimeZone, "タイムゾーンが正しくありません").optional(),
  values: z
    .object({
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

export const commitmentUpdateOutputSchema = z.object({
  id: z.string(),
  content: z.string(),
  frequency: z.enum(commitmentFrequencies),
  weekdays: z.array(z.number()),
  monthDays: z.array(z.number()),
  startDate: z.string(),
  untilDate: z.string(),
  penaltyAmount: z.number().nullable(),
  paymentMethodId: z.string().nullable(),
  timeZone: z.string(),
  settledThrough: z.string().nullable(),
});

// 期間中でも設定を変えられる。開始日と報告履歴はそのまま残る。
export const commitmentUpdateRoute = protectedProcedure
  .input(commitmentUpdateInputSchema)
  .output(commitmentUpdateOutputSchema)
  .mutation(handler);

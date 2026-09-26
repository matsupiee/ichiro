import { checkers, commitmentFrequencies } from "@ichiro/db/schema/commitment";
import { invitationKinds, invitationStatuses } from "@ichiro/db/schema/invitation";
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
      goal: z.string().trim().min(1, "目標を入力してください").max(60),
      content: z.string().trim().min(1, "コミット内容を入力してください").max(200),
      frequency: z.enum(commitmentFrequencies),
      weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      monthDays: z.array(z.number().int().min(1).max(31)).max(31),
      untilDate: z.string().refine(isValidDate, "日付の形式が正しくありません"),
      penaltyAmount: z.number().int().nullable(),
      // consumer.payment.listMethods で返す支払い方法の ID
      paymentMethodId: z.string().nullable(),
      checker: z.enum(checkers),
      friendEmail: z.string().trim().email("友達のメールアドレスが正しくありません").nullable(),
    })
    .superRefine((v, ctx) => {
      for (const issue of validateCommitmentValues(v)) {
        ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
      }
    }),
});

export const commitmentUpdateOutputSchema = z.object({
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
  friendEmail: z.string().nullable(),
  timeZone: z.string(),
  settledThrough: z.string().nullable(),
  // 友達に招待メールを送ったときの結果。送らなかったときは null
  invitation: z
    .object({
      email: z.string(),
      kind: z.enum(invitationKinds),
      status: z.enum(invitationStatuses),
      createdAt: z.date(),
    })
    .nullable(),
});

// 期間中でも設定を変えられる。開始日と報告履歴はそのまま残る。
// チェック役が新しく友達になったか、友達のメールアドレスが変わったときは招待メールを送る
export const commitmentUpdateRoute = protectedProcedure
  .input(commitmentUpdateInputSchema)
  .output(commitmentUpdateOutputSchema)
  .mutation(handler);

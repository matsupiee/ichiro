import { checkers, commitmentFrequencies } from "@ichiro/db/schema/commitment";
import { invitationKinds, invitationStatuses } from "@ichiro/db/schema/invitation";
import { penaltyStatuses } from "@ichiro/db/schema/penalty";
import z from "zod";

import { isPlausibleToday } from "../../../../shared/date/is-plausible-today";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentGetInputSchema = z.object({
  id: z.string(),
  // 端末の現地日付
  today: z.string().refine((d) => isPlausibleToday(d), "今日の日付が正しくありません"),
});

export const commitmentGetOutputSchema = z.object({
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
  dueToday: z.boolean(),
  reportedToday: z.boolean(),
  streak: z.number(),
  // 今日を含む週（月曜はじまり）の7日分
  week: z.array(z.object({ date: z.string(), reported: z.boolean() })),
  // 報告できなかった日の罰金。新しい順
  penalties: z.array(
    z.object({
      id: z.string(),
      dueDate: z.string(),
      amount: z.number(),
      status: z.enum(penaltyStatuses),
      failureMessage: z.string().nullable(),
      paidAt: z.date().nullable(),
    }),
  ),
  penaltyTotal: z.number(),
  // いまの友達に最後に送った招待
  invitation: z
    .object({
      email: z.string(),
      kind: z.enum(invitationKinds),
      status: z.enum(invitationStatuses),
      createdAt: z.date(),
    })
    .nullable(),
});

// コミットメントの詳細。今週の達成状況・罰金の記録・招待メールの送信状況を含む
export const commitmentGetRoute = protectedProcedure
  .input(commitmentGetInputSchema)
  .output(commitmentGetOutputSchema)
  .query(handler);

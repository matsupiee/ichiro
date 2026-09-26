import { commitment, report } from "@ichiro/db/schema/index";
import { checkers, commitmentFrequencies, paymentMethods } from "@ichiro/db/schema/commitment";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";
import { computeStreak, isPlausibleToday, isScheduled, isValidDate, weekOf } from "../lib/schedule";

export const MIN_PENALTY = 100;

const date = z.string().refine(isValidDate, "日付の形式が正しくありません");
const today = date.refine((d) => isPlausibleToday(d), "今日の日付が正しくありません");

const fields = z
  .object({
    goal: z.string().trim().min(1, "目標を入力してください").max(60),
    content: z.string().trim().min(1, "コミット内容を入力してください").max(200),
    frequency: z.enum(commitmentFrequencies),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    monthDays: z.array(z.number().int().min(1).max(31)).max(31),
    untilDate: date,
    penaltyAmount: z
      .number()
      .int()
      .min(MIN_PENALTY, `罰金は${MIN_PENALTY}円以上にしてください`)
      .max(1_000_000)
      .nullable(),
    paymentMethod: z.enum(paymentMethods).nullable(),
    checker: z.enum(checkers),
    friendEmail: z.string().trim().email("友達のメールアドレスが正しくありません").nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "weekly" && v.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "曜日を選んでください" });
    }
    if (v.frequency === "monthly" && v.monthDays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["monthDays"], message: "日付を選んでください" });
    }
    if (v.penaltyAmount !== null && v.paymentMethod === null) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "支払い方法を選んでください",
      });
    }
    if (v.checker === "friend" && !v.friendEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["friendEmail"],
        message: "友達のメールアドレスを入力してください",
      });
    }
  });

type Fields = z.infer<typeof fields>;

function normalize(v: Fields) {
  const hasPenalty = v.penaltyAmount !== null;
  return {
    ...v,
    weekdays: [...new Set(v.weekdays)].sort(),
    monthDays: [...new Set(v.monthDays)].sort((a, b) => a - b),
    paymentMethod: hasPenalty ? v.paymentMethod : null,
    friendEmail: v.checker === "friend" ? v.friendEmail : null,
  };
}

type Row = typeof commitment.$inferSelect;

async function findOwned(ctx: Context & { session: NonNullable<Context["session"]> }, id: string) {
  const [row] = await ctx.db
    .select()
    .from(commitment)
    .where(and(eq(commitment.id, id), eq(commitment.userId, ctx.session.user.id)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "コミットメントが見つかりません" });
  }
  return row;
}

async function reportedDates(db: Context["db"], ids: string[]) {
  const byId = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  if (ids.length === 0) return byId;
  const rows = await db
    .select({ commitmentId: report.commitmentId, reportDate: report.reportDate })
    .from(report)
    .where(inArray(report.commitmentId, ids));
  for (const r of rows) byId.get(r.commitmentId)?.add(r.reportDate);
  return byId;
}

function summarize(row: Row, reported: Set<string>, today: string) {
  const dueToday = isScheduled(row, today);
  return {
    ...row,
    dueToday,
    reportedToday: reported.has(today),
    streak: computeStreak(row, reported, today),
  };
}

export const commitmentRouter = router({
  list: protectedProcedure.input(z.object({ today })).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(commitment)
      .where(eq(commitment.userId, ctx.session.user.id))
      // 同じミリ秒に作られたものは、あとから入れた行を先にする
      .orderBy(desc(commitment.createdAt), desc(sql`rowid`));
    const reported = await reportedDates(
      ctx.db,
      rows.map((r) => r.id),
    );
    return rows.map((r) => summarize(r, reported.get(r.id)!, input.today));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string(), today }))
    .query(async ({ ctx, input }) => {
      const row = await findOwned(ctx, input.id);
      const reported = (await reportedDates(ctx.db, [row.id])).get(row.id)!;
      return { ...summarize(row, reported, input.today), week: weekOf(reported, input.today) };
    }),

  create: protectedProcedure
    .input(z.object({ today, values: fields }))
    .mutation(async ({ ctx, input }) => {
      if (input.values.untilDate < input.today) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "終了日は今日以降にしてください",
        });
      }
      // 友達への招待メール送信は未実装。メールアドレスだけを保存する。
      const [row] = await ctx.db
        .insert(commitment)
        .values({
          ...normalize(input.values),
          userId: ctx.session.user.id,
          startDate: input.today,
        })
        .returning();
      return row!;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), values: fields }))
    .mutation(async ({ ctx, input }) => {
      const current = await findOwned(ctx, input.id);
      if (input.values.untilDate < current.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "終了日は開始日以降にしてください",
        });
      }
      const [row] = await ctx.db
        .update(commitment)
        .set(normalize(input.values))
        .where(eq(commitment.id, current.id))
        .returning();
      return row!;
    }),

  report: protectedProcedure
    .input(z.object({ id: z.string(), today }))
    .mutation(async ({ ctx, input }) => {
      const row = await findOwned(ctx, input.id);
      if (!isScheduled(row, input.today)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "今日は報告日ではありません" });
      }
      const inserted = await ctx.db
        .insert(report)
        .values({ commitmentId: row.id, reportDate: input.today })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) {
        throw new TRPCError({ code: "CONFLICT", message: "今日はもう報告ずみです" });
      }
      const reported = (await reportedDates(ctx.db, [row.id])).get(row.id)!;
      return { streak: computeStreak(row, reported, input.today) };
    }),
});

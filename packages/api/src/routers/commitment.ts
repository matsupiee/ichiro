import { commitment, paymentMethod, penalty, report } from "@ichiro/db/schema/index";
import { checkers, commitmentFrequencies } from "@ichiro/db/schema/commitment";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";
import { isValidTimeZone, settleCommitment, todayIn } from "../lib/penalty";
import {
  addDays,
  computeStreak,
  isPlausibleToday,
  isScheduled,
  isValidDate,
  weekOf,
} from "../lib/schedule";

export const MIN_PENALTY = 100;

const date = z.string().refine(isValidDate, "日付の形式が正しくありません");
const today = date.refine((d) => isPlausibleToday(d), "今日の日付が正しくありません");
// 端末のタイムゾーン（IANA 名）。罰金の締め切りの判定に使う
const timeZone = z.string().refine(isValidTimeZone, "タイムゾーンが正しくありません");

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
    // payment.methods で返す支払い方法の ID
    paymentMethodId: z.string().nullable(),
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
    if (v.penaltyAmount !== null && v.paymentMethodId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethodId"],
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
    paymentMethodId: hasPenalty ? v.paymentMethodId : null,
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

// 罰金を引き落とす支払い方法は、自分が登録したものだけを選べる
async function assertOwnPaymentMethod(
  ctx: Context & { session: NonNullable<Context["session"]> },
  v: Fields,
) {
  if (v.penaltyAmount === null || v.paymentMethodId === null) return;
  const [row] = await ctx.db
    .select({ id: paymentMethod.id })
    .from(paymentMethod)
    .where(
      and(eq(paymentMethod.id, v.paymentMethodId), eq(paymentMethod.userId, ctx.session.user.id)),
    );
  if (!row) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "支払い方法が見つかりません" });
  }
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

async function penaltiesOf(db: Context["db"], id: string) {
  const rows = await db
    .select({
      id: penalty.id,
      dueDate: penalty.dueDate,
      amount: penalty.amount,
      status: penalty.status,
      failureMessage: penalty.failureMessage,
      paidAt: penalty.paidAt,
    })
    .from(penalty)
    .where(eq(penalty.commitmentId, id))
    .orderBy(desc(penalty.dueDate));
  // 徴収できなかったもの（failed）も、支払うべき罰金として合計に入れる
  const total = rows.reduce((sum, p) => sum + p.amount, 0);
  return { penalties: rows, penaltyTotal: total };
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
      // cron を待たずに、締め切りを過ぎた分の罰金を履歴に出す
      const { settledThrough } = await settleCommitment(ctx.db, row);
      const reported = (await reportedDates(ctx.db, [row.id])).get(row.id)!;
      return {
        ...summarize({ ...row, settledThrough }, reported, input.today),
        week: weekOf(reported, input.today),
        ...(await penaltiesOf(ctx.db, row.id)),
      };
    }),

  create: protectedProcedure
    .input(z.object({ today, timeZone: timeZone.optional(), values: fields }))
    .mutation(async ({ ctx, input }) => {
      if (input.values.untilDate < input.today) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "終了日は今日以降にしてください",
        });
      }
      await assertOwnPaymentMethod(ctx, input.values);
      // 友達への招待メール送信は未実装。メールアドレスだけを保存する。
      const [row] = await ctx.db
        .insert(commitment)
        .values({
          ...normalize(input.values),
          userId: ctx.session.user.id,
          startDate: input.today,
          timeZone: input.timeZone,
          // 今日の分から精算の対象にする
          settledThrough: addDays(input.today, -1),
        })
        .returning();
      return row!;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), timeZone: timeZone.optional(), values: fields }))
    .mutation(async ({ ctx, input }) => {
      const current = await findOwned(ctx, input.id);
      if (input.values.untilDate < current.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "終了日は開始日以降にしてください",
        });
      }
      await assertOwnPaymentMethod(ctx, input.values);
      // 締め切りを過ぎた分は変更前の設定で精算し、新しい設定は今日の分から使う。
      // 金額を上げたり終了日を延ばしたりしても、過去の分にはさかのぼらない
      const settled = await settleCommitment(ctx.db, current);
      const now = new Date();
      const zone = input.timeZone ?? current.timeZone;
      const yesterday = addDays(todayIn(zone, now), -1);
      const [row] = await ctx.db
        .update(commitment)
        .set({
          ...normalize(input.values),
          timeZone: zone,
          settledThrough:
            settled.settledThrough !== null && settled.settledThrough > yesterday
              ? settled.settledThrough
              : yesterday,
        })
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
      // 精算ずみの日は締め切りを過ぎている。あとから報告して罰金を逃れることはできない
      const { settledThrough } = await settleCommitment(ctx.db, row);
      if (settledThrough !== null && input.today <= settledThrough) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "締め切りを過ぎたため報告できません",
        });
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

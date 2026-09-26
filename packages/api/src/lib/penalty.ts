import type { Database } from "@ichiro/db";
import { commitment, penalty, report } from "@ichiro/db/schema/index";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import type { PaymentGateway } from "./payment";
import { addDays, isScheduled, type Schedule } from "./schedule";

// 罰金は「報告日の 23:59:59（コミットメントのタイムゾーン）までに報告がなかった」ときに発生する。
//
// 1. 精算: 締め切りを過ぎた報告日のうち、報告がないものに罰金の行（pending）を作る。
//    どこまで精算したかを commitment.settled_through に持ち、同じ日を二度精算しない。
// 2. 徴収: pending（と、回数が残っている failed）の罰金を決済サービスで引き落とす。
//
// どちらも1時間ごとの cron で動く。精算は、設定の変更・報告・詳細の表示のときにも
// そのコミットメントについて先に行い、変更前の設定で過去の分を確定させる。

// 引き落としに失敗したとき、この回数までは次の cron で試し直す
export const MAX_CHARGE_ATTEMPTS = 3;

type Row = typeof commitment.$inferSelect;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// そのタイムゾーンでの今日の日付（YYYY-MM-DD）
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// 締め切りを過ぎた最後の報告日の候補。昨日か終了日の早いほう
export function settleableThrough(row: Pick<Row, "timeZone" | "untilDate">, now: Date): string {
  const yesterday = addDays(todayIn(row.timeZone, now), -1);
  return yesterday < row.untilDate ? yesterday : row.untilDate;
}

// after の翌日から through までの報告日のうち、報告がなかった日
export function missedDates(
  schedule: Schedule,
  reported: Set<string>,
  after: string,
  through: string,
): string[] {
  const missed: string[] = [];
  let date = addDays(after, 1);
  if (date < schedule.startDate) date = schedule.startDate;
  for (let i = 0; i < 3660 && date <= through; i++) {
    if (isScheduled(schedule, date) && !reported.has(date)) missed.push(date);
    date = addDays(date, 1);
  }
  return missed;
}

// 1件のコミットメントを精算し、作った罰金と、どこまで精算したかを返す
export async function settleCommitment(db: Database, row: Row, now: Date = new Date()) {
  const through = settleableThrough(row, now);
  if (row.settledThrough !== null && through <= row.settledThrough) {
    return { created: [], settledThrough: row.settledThrough };
  }

  let created: (typeof penalty.$inferSelect)[] = [];
  // settled_through が null の行（この機能より前に作られた行）は、過去の分をさかのぼって徴収しない
  if (row.settledThrough !== null && row.penaltyAmount !== null && row.paymentMethod !== null) {
    const rows = await db
      .select({ reportDate: report.reportDate })
      .from(report)
      .where(eq(report.commitmentId, row.id));
    const reported = new Set(rows.map((r) => r.reportDate));
    const missed = missedDates(row, reported, row.settledThrough, through);
    // D1 は1文あたりのパラメータ数に上限があるので小分けに入れる
    for (let i = 0; i < missed.length; i += 10) {
      const inserted = await db
        .insert(penalty)
        .values(
          missed.slice(i, i + 10).map((dueDate) => ({
            userId: row.userId,
            commitmentId: row.id,
            dueDate,
            amount: row.penaltyAmount!,
            paymentMethod: row.paymentMethod!,
          })),
        )
        .onConflictDoNothing()
        .returning();
      created = created.concat(inserted);
    }
  }

  await db
    .update(commitment)
    // 精算はユーザーの操作ではないので updated_at は変えない
    .set({ settledThrough: through, updatedAt: row.updatedAt })
    .where(eq(commitment.id, row.id));
  return { created, settledThrough: through };
}

// 精算が終わっていないコミットメントをすべて精算する
export async function settleAll(db: Database, now: Date = new Date()) {
  const rows = await db
    .select()
    .from(commitment)
    .where(
      or(isNull(commitment.settledThrough), lt(commitment.settledThrough, commitment.untilDate)),
    );
  let created = 0;
  for (const row of rows) {
    created += (await settleCommitment(db, row, now)).created.length;
  }
  return created;
}

// 未徴収の罰金を引き落とす
export async function collectPenalties(
  db: Database,
  gateway: PaymentGateway,
  now: Date = new Date(),
) {
  const due = await db
    .select({ penalty, goal: commitment.goal })
    .from(penalty)
    .innerJoin(commitment, eq(commitment.id, penalty.commitmentId))
    .where(
      or(
        eq(penalty.status, "pending"),
        and(eq(penalty.status, "failed"), lt(penalty.attempts, MAX_CHARGE_ATTEMPTS)),
      ),
    );

  let paid = 0;
  let failed = 0;
  for (const { penalty: p, goal } of due) {
    const result = await gateway
      .charge({
        idempotencyKey: p.id,
        userId: p.userId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        description: `ichiro 罰金「${goal}」${p.dueDate}`,
      })
      .catch((e: unknown) => ({
        ok: false as const,
        message: e instanceof Error ? e.message : String(e),
      }));

    if (result.ok) {
      paid++;
      await db
        .update(penalty)
        .set({
          status: "paid",
          attempts: p.attempts + 1,
          chargeReference: result.reference,
          failureMessage: null,
          paidAt: now,
        })
        .where(eq(penalty.id, p.id));
    } else {
      failed++;
      await db
        .update(penalty)
        .set({ status: "failed", attempts: p.attempts + 1, failureMessage: result.message })
        .where(eq(penalty.id, p.id));
    }
  }
  return { paid, failed };
}

// cron から呼ぶ。精算してから徴収する
export async function runPenaltyJob(db: Database, gateway: PaymentGateway, now: Date = new Date()) {
  const created = await settleAll(db, now);
  const { paid, failed } = await collectPenalties(db, gateway, now);
  return { created, paid, failed };
}

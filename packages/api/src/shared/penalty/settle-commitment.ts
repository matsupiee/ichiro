import type { Database } from "@ichiro/db";
import { commitment, penalty, report } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { missedDates } from "./missed-dates";
import { settleableThrough } from "./settleable-through";

// 罰金は「報告日の 23:59:59（コミットメントのタイムゾーン）までに報告がなかった」ときに発生する。
// 締め切りを過ぎた報告日のうち、報告がないものに罰金の行（pending）を作る。
// どこまで精算したかを commitment.settled_through に持ち、同じ日を二度精算しない。
//
// 1時間ごとの cron のほか、設定の変更・報告・詳細の表示のときにもそのコミットメントについて先に行い、
// 変更前の設定で過去の分を確定させる。作った罰金と、どこまで精算したかを返す
export async function settleCommitment(
  db: Database,
  row: typeof commitment.$inferSelect,
  now: Date = new Date(),
) {
  const through = settleableThrough(row, now);
  if (row.settledThrough !== null && through <= row.settledThrough) {
    return { created: [], settledThrough: row.settledThrough };
  }

  let created: (typeof penalty.$inferSelect)[] = [];
  // settled_through が null の行（この機能より前に作られた行）は、過去の分をさかのぼって徴収しない
  if (row.settledThrough !== null && row.penaltyAmount !== null) {
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
            // 支払い方法がなくても罰金は記録する。徴収のときに失敗として残る
            paymentMethodId: row.paymentMethodId,
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

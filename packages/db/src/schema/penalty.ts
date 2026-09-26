import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { commitment } from "./commitment";
import { paymentMethod } from "./payment-method";

// pending: 徴収待ち / processing: Stripe で処理中（Webhook で確定する） / paid: 徴収ずみ / failed: 徴収できなかった
export const penaltyStatuses = ["pending", "processing", "paid", "failed"] as const;
export type PenaltyStatus = (typeof penaltyStatuses)[number];

// 報告日の締め切りまでに報告できなかったときの罰金。1回の未達成につき1行
export const penalty = sqliteTable(
  "penalty",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    commitmentId: text("commitment_id")
      .notNull()
      .references(() => commitment.id, { onDelete: "cascade" }),
    // 報告できなかった報告日（ユーザーの現地日付 YYYY-MM-DD）
    dueDate: text("due_date").notNull(),
    // 精算した時点のコミットメントの金額と支払い方法を写しておく
    amount: integer("amount").notNull(),
    // null は支払い方法が登録されていない（この変更より前に作られたコミットメント）。徴収できない
    paymentMethodId: text("payment_method_id").references(() => paymentMethod.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: penaltyStatuses }).notNull().default("pending"),
    // 決済を試みた回数。失敗が続いたら打ち切る
    attempts: integer("attempts").notNull().default(0),
    // Stripe の PaymentIntent の ID
    chargeReference: text("charge_reference"),
    failureMessage: text("failure_message"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    // 同じ報告日の罰金を二重に作らない
    uniqueIndex("penalty_commitment_date_idx").on(table.commitmentId, table.dueDate),
    index("penalty_userId_idx").on(table.userId),
    index("penalty_status_idx").on(table.status),
  ],
);

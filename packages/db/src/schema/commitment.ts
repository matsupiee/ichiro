import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { paymentMethod } from "./payment-method";

export const commitmentFrequencies = ["daily", "weekly", "monthly", "once"] as const;
export const checkers = ["self", "friend"] as const;

export type CommitmentFrequency = (typeof commitmentFrequencies)[number];
export type Checker = (typeof checkers)[number];

export const commitment = sqliteTable(
  "commitment",
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
    goal: text("goal").notNull(),
    content: text("content").notNull(),
    frequency: text("frequency", { enum: commitmentFrequencies }).notNull(),
    // 0 = 日曜 ... 6 = 土曜。frequency が weekly のときだけ意味を持つ
    weekdays: text("weekdays", { mode: "json" }).$type<number[]>().notNull(),
    // 1〜31。frequency が monthly のときだけ意味を持つ
    monthDays: text("month_days", { mode: "json" }).$type<number[]>().notNull(),
    // 日付はユーザーの現地日付を YYYY-MM-DD で持つ
    startDate: text("start_date").notNull(),
    untilDate: text("until_date").notNull(),
    // null は罰金なし
    penaltyAmount: integer("penalty_amount"),
    // 罰金を引き落とす支払い方法。罰金ありのときだけ入る
    paymentMethodId: text("payment_method_id").references(() => paymentMethod.id, {
      onDelete: "restrict",
    }),
    checker: text("checker", { enum: checkers }).notNull(),
    // 未承認の依頼リンク。承認・チェック者の変更時に無効にする
    shareToken: text("share_token").unique(),
    checkerUserId: text("checker_user_id").references(() => user.id, { onDelete: "set null" }),
    // 締め切り（報告日の 23:59:59）を判定するタイムゾーン。IANA 名
    timeZone: text("time_zone").notNull().default("Asia/Tokyo"),
    // 罰金の精算がどの報告日まで終わったか（YYYY-MM-DD）。
    // null は未精算
    settledThrough: text("settled_through"),
  },
  (table) => [index("commitment_userId_idx").on(table.userId)],
);

import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const commitmentFrequencies = ["daily", "weekly", "monthly", "once"] as const;
export const paymentMethods = ["apple_pay", "card"] as const;
export const checkers = ["self", "friend"] as const;

export type CommitmentFrequency = (typeof commitmentFrequencies)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type Checker = (typeof checkers)[number];

export const commitment = sqliteTable(
  "commitment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
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
    paymentMethod: text("payment_method", { enum: paymentMethods }),
    checker: text("checker", { enum: checkers }).notNull(),
    friendEmail: text("friend_email"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("commitment_userId_idx").on(table.userId)],
);

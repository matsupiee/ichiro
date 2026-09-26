import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { commitment } from "./commitment";

export const report = sqliteTable(
  "report",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    commitmentId: text("commitment_id")
      .notNull()
      .references(() => commitment.id, { onDelete: "cascade" }),
    // 達成した日（ユーザーの現地日付 YYYY-MM-DD）
    reportDate: text("report_date").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    // 同じ日に同じコミットメントを二重に報告できない
    uniqueIndex("report_commitment_date_idx").on(table.commitmentId, table.reportDate),
  ],
);

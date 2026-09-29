import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { commitment } from "./commitment";

// JSON 内の日時は SQLite と同じ epoch milliseconds。配列は JSON 配列として保存する。
type CommitmentSnapshot = Omit<typeof commitment.$inferSelect, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

// 元のコミットメント・ユーザー・支払い方法が削除されても調査用の履歴を残す。
// INSERT は migration の commitment_log_before_update トリガーが担当する。
export const commitmentLog = sqliteTable(
  "commitment_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commitmentId: text("commitment_id").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<CommitmentSnapshot>().notNull(),
  },
  (table) => [index("commitment_log_commitmentId_id_idx").on(table.commitmentId, table.id)],
);

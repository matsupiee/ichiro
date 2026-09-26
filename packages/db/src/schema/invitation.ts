import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { commitment } from "./commitment";

// registered: すでに ichiro に登録ずみの友達へのチェックのお願い
// sign_up: まだ登録していない友達への会員登録のお願い
export const invitationKinds = ["registered", "sign_up"] as const;
export const invitationStatuses = ["sent", "failed"] as const;

export type InvitationKind = (typeof invitationKinds)[number];
export type InvitationStatus = (typeof invitationStatuses)[number];

// 友達に送った招待メール。送るたびに1行ずつ増える
export const invitation = sqliteTable(
  "invitation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    commitmentId: text("commitment_id")
      .notNull()
      .references(() => commitment.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    kind: text("kind", { enum: invitationKinds }).notNull(),
    status: text("status", { enum: invitationStatuses }).notNull(),
    // Resend が返すメールの ID。送れなかったときは null
    messageId: text("message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("invitation_commitmentId_idx").on(table.commitmentId)],
);

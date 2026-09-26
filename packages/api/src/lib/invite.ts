import { user } from "@ichiro/db/schema/auth";
import type { commitment } from "@ichiro/db/schema/commitment";
import { invitation } from "@ichiro/db/schema/invitation";
import { and, desc, eq, sql } from "drizzle-orm";

import type { AuthedContext, Context } from "../context";
import { invitationEmail } from "./invitation-email";

// 同じ相手への再送は、前回の送信からこれだけあける
export const RESEND_COOLDOWN_MS = 60_000;

type CommitmentRow = typeof commitment.$inferSelect;
type InvitationRow = typeof invitation.$inferSelect;

export type InvitationSummary = Pick<InvitationRow, "email" | "kind" | "status" | "createdAt">;

function summarize(row: InvitationRow): InvitationSummary {
  return { email: row.email, kind: row.kind, status: row.status, createdAt: row.createdAt };
}

// いまの友達のメールアドレスに最後に送った招待
export async function latestInvitation(
  db: Context["db"],
  row: CommitmentRow,
): Promise<InvitationSummary | null> {
  if (row.checker !== "friend" || !row.friendEmail) return null;
  const [latest] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.commitmentId, row.id), eq(invitation.email, row.friendEmail)))
    .orderBy(desc(invitation.createdAt), desc(sql`rowid`))
    .limit(1);
  return latest ? summarize(latest) : null;
}

// 友達に招待メールを送り、結果を invitation テーブルに残す。
// 送れなくてもコミットメントの保存は取り消さず、status = failed として返す
export async function sendInvitation(
  ctx: AuthedContext,
  row: CommitmentRow,
): Promise<InvitationSummary> {
  const email = row.friendEmail!;
  const [registered] = await ctx.db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email.toLowerCase()));
  const kind = registered ? "registered" : "sign_up";

  let messageId: string | null = null;
  try {
    const sent = await ctx.mailer.send(
      invitationEmail({
        kind,
        to: email,
        inviter: { name: ctx.session.user.name, email: ctx.session.user.email },
        commitment: row,
      }),
    );
    messageId = sent.id;
  } catch (e) {
    console.error("招待メールを送れませんでした", e);
  }

  const [inserted] = await ctx.db
    .insert(invitation)
    .values({ commitmentId: row.id, email, kind, status: messageId ? "sent" : "failed", messageId })
    .returning();
  return summarize(inserted!);
}

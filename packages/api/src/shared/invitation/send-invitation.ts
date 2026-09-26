import { user } from "@ichiro/db/schema/auth";
import type { commitment } from "@ichiro/db/schema/commitment";
import { invitation } from "@ichiro/db/schema/invitation";
import { eq, sql } from "drizzle-orm";

import type { AuthedContext } from "../../context";
import { buildInvitationEmail } from "./build-invitation-email";

// 友達に招待メールを送り、結果を invitation テーブルに残す。
// 送れなくてもコミットメントの保存は取り消さず、status = failed の行を返す
export async function sendInvitation(
  context: Pick<AuthedContext, "db" | "mailer" | "session">,
  row: typeof commitment.$inferSelect,
) {
  const email = row.friendEmail!;
  const [registered] = await context.db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email.toLowerCase()));
  const kind = registered ? "registered" : "sign_up";

  let messageId: string | null = null;
  try {
    const sent = await context.mailer.send(
      buildInvitationEmail({
        kind,
        to: email,
        inviter: { name: context.session.user.name, email: context.session.user.email },
        commitment: row,
      }),
    );
    messageId = sent.id;
  } catch (e) {
    console.error("招待メールを送れませんでした", e);
  }

  const [inserted] = await context.db
    .insert(invitation)
    .values({ commitmentId: row.id, email, kind, status: messageId ? "sent" : "failed", messageId })
    .returning();
  return inserted!;
}

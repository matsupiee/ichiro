import { paymentMethod } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import type { AuthedContext } from "../../context";
import type { CommitmentValues } from "./validate-commitment-values";

// ログイン中のユーザーが保存してよい設定か。作成と変更の両方で確かめる
export async function assertCommitmentValuesAllowed(
  context: Pick<AuthedContext, "db" | "session">,
  v: CommitmentValues,
) {
  const me = context.session.user;
  if (v.checker === "friend" && v.friendEmail?.toLowerCase() === me.email.toLowerCase()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "自分のメールアドレスは指定できません" });
  }
  // 罰金を引き落とす支払い方法は、自分が登録したものだけを選べる
  if (v.penaltyAmount === null || v.paymentMethodId === null) return;
  const [row] = await context.db
    .select({ id: paymentMethod.id })
    .from(paymentMethod)
    .where(and(eq(paymentMethod.id, v.paymentMethodId), eq(paymentMethod.userId, me.id)));
  if (!row) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "支払い方法が見つかりません" });
  }
}

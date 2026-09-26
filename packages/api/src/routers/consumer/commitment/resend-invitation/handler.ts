import { TRPCError } from "@trpc/server";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { findOwnCommitment } from "../../../../shared/commitment/find-own-commitment";
import { findLatestInvitation } from "../../../../shared/invitation/find-latest-invitation";
import { sendInvitation } from "../../../../shared/invitation/send-invitation";
import type { commitmentResendInvitationInputSchema } from "./route";

// 同じ相手への再送は、前回の送信からこれだけあける
const RESEND_COOLDOWN_MS = 60_000;

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof commitmentResendInvitationInputSchema>;
}) {
  const row = await findOwnCommitment(ctx, input.id);
  if (row.checker !== "friend" || !row.friendEmail) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "友達にチェックしてもらう設定になっていません",
    });
  }
  const latest = await findLatestInvitation(ctx.db, row);
  if (latest?.status === "sent" && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "少し時間をおいてから再送してください",
    });
  }
  return sendInvitation(ctx, row);
}

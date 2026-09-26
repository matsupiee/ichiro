import { invitationKinds, invitationStatuses } from "@ichiro/db/schema/invitation";
import z from "zod";

import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentResendInvitationInputSchema = z.object({
  id: z.string(),
});

export const commitmentResendInvitationOutputSchema = z.object({
  email: z.string(),
  kind: z.enum(invitationKinds),
  status: z.enum(invitationStatuses),
  createdAt: z.date(),
});

// 友達への招待メールを送り直す。送ったばかりなら少し待ってもらう
export const commitmentResendInvitationRoute = protectedProcedure
  .input(commitmentResendInvitationInputSchema)
  .output(commitmentResendInvitationOutputSchema)
  .mutation(handler);

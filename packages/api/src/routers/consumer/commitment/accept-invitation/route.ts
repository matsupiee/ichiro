import z from "zod";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";
export const commitmentAcceptInvitationInputSchema = z.object({ token: z.uuid() });
export const commitmentAcceptInvitationOutputSchema = z.object({ goal: z.string() });
export const commitmentAcceptInvitationRoute = protectedProcedure
  .input(commitmentAcceptInvitationInputSchema)
  .output(commitmentAcceptInvitationOutputSchema)
  .mutation(handler);

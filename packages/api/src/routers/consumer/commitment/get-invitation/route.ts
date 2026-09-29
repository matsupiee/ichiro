import z from "zod";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";
export const commitmentGetInvitationInputSchema = z.object({ token: z.uuid() });
export const commitmentGetInvitationOutputSchema = z.object({
  ownerName: z.string(),
  goal: z.string(),
  content: z.string(),
  untilDate: z.string(),
  isOwn: z.boolean(),
});
export const commitmentGetInvitationRoute = protectedProcedure
  .input(commitmentGetInvitationInputSchema)
  .output(commitmentGetInvitationOutputSchema)
  .query(handler);

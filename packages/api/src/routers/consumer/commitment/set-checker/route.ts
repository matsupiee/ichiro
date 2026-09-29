import z from "zod";
import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const commitmentSetCheckerInputSchema = z.object({
  id: z.string(),
  selection: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("self") }),
    z.object({ mode: z.literal("link") }),
    z.object({ mode: z.literal("friend"), userId: z.string() }),
  ]),
});
export const commitmentSetCheckerOutputSchema = z.object({
  checker: z.enum(["self", "friend"]),
  checkerUserId: z.string().nullable(),
  shareToken: z.string().nullable(),
});
export const commitmentSetCheckerRoute = protectedProcedure
  .input(commitmentSetCheckerInputSchema)
  .output(commitmentSetCheckerOutputSchema)
  .mutation(handler);

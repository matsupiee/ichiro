import z from "zod";
import { withdrawalProcedure } from "../../../../trpc";
import { handler } from "./handler";

const accountWithdrawInputSchema = z.object({ acknowledged: z.literal(true) });
const accountWithdrawOutputSchema = z.object({ status: z.enum(["completed", "pending"]) });
export const accountWithdrawRoute = withdrawalProcedure
  .input(accountWithdrawInputSchema)
  .output(accountWithdrawOutputSchema)
  .mutation(handler);

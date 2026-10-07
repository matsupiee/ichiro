import z from "zod";

import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const paymentStartSetupOutputSchema = z.object({
  setupIntentClientSecret: z.string(),
});

// Stripe の Payment Element で支払い方法（カード）を登録するための SetupIntent を作る
export const paymentStartSetupRoute = protectedProcedure
  .output(paymentStartSetupOutputSchema)
  .mutation(handler);

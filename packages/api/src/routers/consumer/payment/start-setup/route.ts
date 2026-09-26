import z from "zod";

import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const paymentStartSetupOutputSchema = z.object({
  customerId: z.string(),
  ephemeralKeySecret: z.string(),
  setupIntentClientSecret: z.string(),
});

// PaymentSheet で支払い方法を登録するための SetupIntent と、端末用の一時キーを作る
export const paymentStartSetupRoute = protectedProcedure
  .output(paymentStartSetupOutputSchema)
  .mutation(handler);

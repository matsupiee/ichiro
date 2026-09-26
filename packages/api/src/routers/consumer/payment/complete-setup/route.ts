import { paymentWallets } from "@ichiro/db/schema/payment-method";
import z from "zod";

import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const paymentCompleteSetupInputSchema = z.object({
  setupIntentClientSecret: z.string().regex(/^seti_[^_]+_secret_/),
});

export const paymentCompleteSetupOutputSchema = z.object({
  id: z.string(),
  brand: z.string(),
  last4: z.string(),
  wallet: z.enum(paymentWallets).nullable(),
});

// PaymentSheet で登録が終わったら呼ぶ。登録した支払い方法を返す
export const paymentCompleteSetupRoute = protectedProcedure
  .input(paymentCompleteSetupInputSchema)
  .output(paymentCompleteSetupOutputSchema)
  .mutation(handler);

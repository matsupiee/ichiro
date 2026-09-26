import { paymentWallets } from "@ichiro/db/schema/payment-method";
import z from "zod";

import { protectedProcedure } from "../../../../trpc";
import { handler } from "./handler";

export const paymentListMethodsOutputSchema = z.array(
  z.object({
    id: z.string(),
    brand: z.string(),
    last4: z.string(),
    wallet: z.enum(paymentWallets).nullable(),
  }),
);

// 登録ずみの支払い方法。古い順
export const paymentListMethodsRoute = protectedProcedure
  .output(paymentListMethodsOutputSchema)
  .query(handler);

import { paymentCustomer } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type z from "zod";

import type { AuthedContext } from "../../../../context";
import { savePaymentMethod } from "../../../../shared/payment/save-payment-method";
import type { paymentCompleteSetupInputSchema } from "./route";

export async function handler({
  ctx,
  input,
}: {
  ctx: AuthedContext;
  input: z.infer<typeof paymentCompleteSetupInputSchema>;
}) {
  const setupIntentId = input.setupIntentClientSecret.split("_secret_")[0]!;
  const [customer] = await ctx.db
    .select()
    .from(paymentCustomer)
    .where(eq(paymentCustomer.userId, ctx.session.user.id));
  const setupIntent = await ctx.stripe.setupIntents
    .retrieve(setupIntentId, { expand: ["payment_method"] })
    .catch(() => null);
  const setupCustomerId =
    typeof setupIntent?.customer === "string" ? setupIntent.customer : setupIntent?.customer?.id;
  // ほかのユーザーの SetupIntent を持ち込んでも保存しない
  if (!setupIntent || !customer || setupCustomerId !== customer.stripeCustomerId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "支払い方法の登録が見つかりません" });
  }
  if (setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "支払い方法の登録が終わっていません" });
  }
  const pm =
    typeof setupIntent.payment_method === "string"
      ? await ctx.stripe.paymentMethods.retrieve(setupIntent.payment_method)
      : setupIntent.payment_method;
  try {
    const row = await savePaymentMethod(ctx.db, ctx.session.user.id, pm);
    return { id: row.id, brand: row.brand, last4: row.last4, wallet: row.wallet };
  } catch (e) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "支払い方法を登録できませんでした",
    });
  }
}

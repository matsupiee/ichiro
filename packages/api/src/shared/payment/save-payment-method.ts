import type { Database } from "@ichiro/db";
import { paymentMethod } from "@ichiro/db/schema/index";
import { paymentWallets, type PaymentWallet } from "@ichiro/db/schema/payment-method";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

// Stripe の支払い方法を payment_method に保存する。同じものは1行だけ。
// アプリからの登録完了と Webhook の両方から呼ばれる
export async function savePaymentMethod(db: Database, userId: string, pm: Stripe.PaymentMethod) {
  if (pm.type !== "card" || !pm.card) {
    throw new Error("カード以外の支払い方法には対応していません");
  }
  const walletType = pm.card.wallet?.type ?? null;
  const wallet = paymentWallets.find((w) => w === walletType) ?? null;
  await db
    .insert(paymentMethod)
    .values({
      userId,
      stripePaymentMethodId: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      wallet: wallet satisfies PaymentWallet | null,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.stripePaymentMethodId, pm.id));
  if (!row || row.userId !== userId) {
    throw new Error("支払い方法を保存できませんでした");
  }
  return row;
}

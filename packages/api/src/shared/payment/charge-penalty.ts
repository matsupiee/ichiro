import Stripe from "stripe";

import type { StripeClient } from "../../third-party-lib/stripe";
import { cardErrorMessage } from "./card-error-message";

export type ChargeRequest = {
  // 同じ試行を二重に引き落とさないためのキー
  idempotencyKey: string;
  penaltyId: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  amount: number;
  description: string;
};

// succeeded: 引き落とせた / processing: Stripe 側で処理中（結果は Webhook で届く） / failed: 引き落とせなかった
export type ChargeResult =
  | { status: "succeeded"; reference: string }
  | { status: "processing"; reference: string }
  | { status: "failed"; reference: string | null; message: string };

// 罰金を Stripe で引き落とす。ユーザーがいないときに、保存した支払い方法で決済する
export async function chargePenalty(
  stripe: StripeClient,
  request: ChargeRequest,
): Promise<ChargeResult> {
  try {
    const intent = await stripe.paymentIntents.create(
      {
        // 円はそのままの金額で渡す（小数のない通貨）
        amount: request.amount,
        currency: "jpy",
        customer: request.stripeCustomerId,
        payment_method: request.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: request.description,
        metadata: { penalty_id: request.penaltyId },
      },
      { idempotencyKey: request.idempotencyKey },
    );
    if (intent.status === "succeeded") return { status: "succeeded", reference: intent.id };
    if (intent.status === "processing") return { status: "processing", reference: intent.id };
    return {
      status: "failed",
      reference: intent.id,
      message: `決済が完了しませんでした（${intent.status}）`,
    };
  } catch (e) {
    // カードが原因の失敗は、試し直すかどうかを決めるために結果として返す
    if (e instanceof Stripe.errors.StripeCardError) {
      return {
        status: "failed",
        reference: e.payment_intent?.id ?? null,
        message: cardErrorMessage(e.code, e.message),
      };
    }
    // Stripe に届かなかったときなども、失敗として記録して次の罰金に進む
    return {
      status: "failed",
      reference: null,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

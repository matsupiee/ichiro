import Stripe from "stripe";

// 使う Stripe の API だけを抜き出した型。テストではこの形の偽物を渡す
export type StripeClient = {
  customers: Pick<Stripe["customers"], "create">;
  ephemeralKeys: Pick<Stripe["ephemeralKeys"], "create">;
  setupIntents: Pick<Stripe["setupIntents"], "create" | "retrieve">;
  paymentMethods: Pick<Stripe["paymentMethods"], "retrieve">;
  paymentIntents: Pick<Stripe["paymentIntents"], "create">;
};

export function createStripe(secretKey: string) {
  return new Stripe(secretKey);
}

// Webhook の署名を確かめてイベントを取り出す。Workers でも動くよう非同期版を使う
export function verifyStripeEvent(
  stripe: Stripe,
  payload: string,
  signature: string,
  webhookSecret: string,
) {
  return stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
}

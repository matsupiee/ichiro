import { createServerFn } from "@tanstack/react-start";
// pure を使い、支払い方法を追加するときだけ Stripe.js を読み込む
import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";

import { ENV } from "../server/env.server";

// 公開可能キーはビルドに埋め込まず、デプロイ先の環境変数から渡す
export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(
  () => ENV.STRIPE_PUBLISHABLE_KEY,
);

const loaded = new Map<string, Promise<Stripe | null>>();

// Stripe.js は使うときに初めて読み込む。同じキーなら読み込みを使い回す
export function loadStripeOnce(publishableKey: string) {
  let stripe = loaded.get(publishableKey);
  if (!stripe) {
    stripe = loadStripe(publishableKey);
    loaded.set(publishableKey, stripe);
  }
  return stripe;
}

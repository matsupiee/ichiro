import { handleStripeEvent } from "@ichiro/api/shared/payment/handle-stripe-event";
import { verifyStripeEvent } from "@ichiro/api/third-party-lib/stripe";

import { ENV } from "./env.server";
import { getDb, getStripe } from "./services";

// Stripe の Webhook。引き落としの結果と、支払い方法の登録を反映する
export async function handleStripeWebhook(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });
  const stripe = getStripe();
  let event;
  try {
    event = await verifyStripeEvent(
      stripe,
      await request.text(),
      signature,
      ENV.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  await handleStripeEvent(getDb(), stripe, event);
  return Response.json({ received: true });
}

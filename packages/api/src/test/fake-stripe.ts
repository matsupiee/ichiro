import Stripe from "stripe";

import type { StripeClient } from "../third-party-lib/stripe";

type ChargeOutcome =
  | "succeeded"
  | "processing"
  | "requires_action"
  | "card_declined"
  | "authentication_required"
  | "decline_authentication_required";

type FakePaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  wallet?: "apple_pay" | "google_pay";
};

function toPaymentMethod(pm: FakePaymentMethod) {
  return {
    id: pm.id,
    object: "payment_method",
    type: "card",
    card: { brand: pm.brand, last4: pm.last4, wallet: pm.wallet ? { type: pm.wallet } : null },
  } as unknown as Stripe.PaymentMethod;
}

// テスト用の Stripe。呼ばれた内容を記録し、決済の結果を決められる
export function createFakeStripe() {
  let seq = 0;
  const next = (prefix: string) => `${prefix}_fake${++seq}`;

  const customers = new Map<string, string>(); // idempotencyKey → customer id
  const setupIntents = new Map<
    string,
    { customer: string; status: string; paymentMethod: FakePaymentMethod | null }
  >();
  const paymentMethods = new Map<string, FakePaymentMethod>();
  const charges: { params: Stripe.PaymentIntentCreateParams; idempotencyKey?: string }[] = [];
  let outcome: ChargeOutcome = "succeeded";

  const client: StripeClient = {
    customers: {
      create: (async (_params, options) => {
        const key = options?.idempotencyKey ?? next("key");
        if (!customers.has(key)) customers.set(key, next("cus"));
        return { id: customers.get(key)! };
      }) as StripeClient["customers"]["create"],
    },
    setupIntents: {
      create: (async (params) => {
        const id = next("seti");
        setupIntents.set(id, {
          customer: params!.customer as string,
          status: "requires_payment_method",
          paymentMethod: null,
        });
        return { id, client_secret: `${id}_secret_abc` };
      }) as StripeClient["setupIntents"]["create"],
      retrieve: (async (id) => {
        const si = setupIntents.get(id);
        if (!si) throw new Error(`No such setupintent: ${id}`);
        return {
          id,
          customer: si.customer,
          status: si.status,
          payment_method: si.paymentMethod ? toPaymentMethod(si.paymentMethod) : null,
        };
      }) as StripeClient["setupIntents"]["retrieve"],
    },
    paymentMethods: {
      retrieve: (async (id) =>
        toPaymentMethod(paymentMethods.get(id)!)) as StripeClient["paymentMethods"]["retrieve"],
    },
    paymentIntents: {
      create: (async (params, options) => {
        charges.push({ params: params!, idempotencyKey: options?.idempotencyKey });
        const id = next("pi");
        if (
          outcome === "card_declined" ||
          outcome === "authentication_required" ||
          outcome === "decline_authentication_required"
        ) {
          throw new Stripe.errors.StripeCardError({
            type: "card_error",
            code: outcome === "decline_authentication_required" ? "card_declined" : outcome,
            decline_code:
              outcome === "decline_authentication_required" ? "authentication_required" : undefined,
            message: `Stripe: ${outcome}`,
            payment_intent: { id } as Stripe.PaymentIntent,
          });
        }
        return { id, status: outcome };
      }) as StripeClient["paymentIntents"]["create"],
    },
  };

  return {
    client,
    charges,
    setupIntentCount: () => setupIntents.size,
    customerCount: () => customers.size,
    // 次からの引き落としの結果を決める
    willCharge(next: ChargeOutcome) {
      outcome = next;
    },
    // ユーザーが PaymentSheet でカードを登録し終えたことにする
    completeSetup(setupIntentId: string, pm: Omit<FakePaymentMethod, "id">) {
      const si = setupIntents.get(setupIntentId)!;
      const method = { id: next("pm"), ...pm };
      paymentMethods.set(method.id, method);
      si.status = "succeeded";
      si.paymentMethod = method;
      return method.id;
    },
  };
}

export type FakeStripe = ReturnType<typeof createFakeStripe>;

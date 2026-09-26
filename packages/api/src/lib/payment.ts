export type ChargeRequest = {
  // 同じ試行を二重に引き落とさないためのキー
  idempotencyKey: string;
  penaltyId: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  amount: number;
  description: string;
};

// succeeded: 引き落とせた / processing: 決済サービス側で処理中（結果は Webhook で届く） / failed: 引き落とせなかった
export type ChargeResult =
  | { status: "succeeded"; reference: string }
  | { status: "processing"; reference: string }
  | { status: "failed"; reference: string | null; message: string };

// 罰金を引き落とす決済サービスの窓口。本番は Stripe（lib/stripe.ts）、テストでは偽物を渡す
export type PaymentGateway = {
  charge(request: ChargeRequest): Promise<ChargeResult>;
};

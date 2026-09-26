import type { PaymentMethod } from "@ichiro/db/schema/commitment";

export type ChargeRequest = {
  // 同じ罰金を二重に引き落とさないためのキー。罰金の ID を使う
  idempotencyKey: string;
  userId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
};

export type ChargeResult = { ok: true; reference: string } | { ok: false; message: string };

// 罰金を引き落とす決済サービスの窓口。実際の決済サービスとつなぐときはこれを実装する
export type PaymentGateway = {
  charge(request: ChargeRequest): Promise<ChargeResult>;
};

// 決済サービスとはまだつながっていないので、引き落としに成功したことにする仮の窓口
export const stubPaymentGateway: PaymentGateway = {
  async charge(request) {
    return { ok: true, reference: `stub_${request.idempotencyKey}` };
  },
};

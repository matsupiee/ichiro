export type PaymentMethodSummary = {
  id: string;
  brand: string;
  last4: string;
  wallet: "apple_pay" | "google_pay" | null;
};

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  jcb: "JCB",
  diners: "Diners Club",
  discover: "Discover",
  unionpay: "UnionPay",
};

// 「Visa •••• 4242」のような表示。ネイティブ版で Apple Pay・Google Pay 経由で登録したものはそれと分かるようにする
export function paymentMethodLabel(m: PaymentMethodSummary): string {
  const card = `${BRANDS[m.brand] ?? m.brand} •••• ${m.last4}`;
  if (m.wallet === "apple_pay") return `Apple Pay（${card}）`;
  if (m.wallet === "google_pay") return `Google Pay（${card}）`;
  return card;
}

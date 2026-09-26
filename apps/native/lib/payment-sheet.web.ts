import type { SetupSession, SheetResult } from "./payment-sheet";

export type { SetupSession, SheetResult } from "./payment-sheet";

// Stripe の React Native SDK は Web に対応していない。支払い方法の登録はアプリから行う
export function usePaymentSheet() {
  return async (_session: SetupSession): Promise<SheetResult> => ({
    status: "failed",
    message: "支払い方法の登録は iPhone・Android のアプリから行ってください",
  });
}

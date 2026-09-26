import { PaymentSheetError, useStripe } from "@stripe/stripe-react-native";

import { STRIPE_RETURN_URL } from "@/lib/stripe-config";

export type SetupSession = {
  customerId: string;
  ephemeralKeySecret: string;
  setupIntentClientSecret: string;
};

export type SheetResult =
  | { status: "completed" }
  | { status: "canceled" }
  | { status: "failed"; message: string };

// Stripe の PaymentSheet で支払い方法（カード・Apple Pay）を登録する
export function usePaymentSheet() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return async (session: SetupSession): Promise<SheetResult> => {
    const init = await initPaymentSheet({
      merchantDisplayName: "ichiro",
      customerId: session.customerId,
      customerEphemeralKeySecret: session.ephemeralKeySecret,
      setupIntentClientSecret: session.setupIntentClientSecret,
      applePay: { merchantCountryCode: "JP" },
      returnURL: STRIPE_RETURN_URL,
      style: "alwaysLight",
    });
    if (init.error) return { status: "failed", message: init.error.message };

    const { error } = await presentPaymentSheet();
    if (!error) return { status: "completed" };
    if (error.code === PaymentSheetError.Canceled) return { status: "canceled" };
    return { status: "failed", message: error.message };
  };
}

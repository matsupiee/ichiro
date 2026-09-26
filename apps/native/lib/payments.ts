import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "react-native";

import { usePaymentSheet } from "@/lib/payment-sheet";
import { trpc } from "@/utils/trpc";

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

// 「Apple Pay（Visa •••• 4242）」「Mastercard •••• 4444」のような表示
export function paymentMethodLabel(m: PaymentMethodSummary): string {
  const card = `${BRANDS[m.brand] ?? m.brand} •••• ${m.last4}`;
  if (m.wallet === "apple_pay") return `Apple Pay（${card}）`;
  if (m.wallet === "google_pay") return `Google Pay（${card}）`;
  return card;
}

// Stripe の PaymentSheet を開いて支払い方法を登録する。登録できたらその支払い方法を返す
export function useAddPaymentMethod() {
  const queryClient = useQueryClient();
  const presentSheet = usePaymentSheet();
  const start = useMutation(trpc.consumer.payment.startSetup.mutationOptions());
  const complete = useMutation(trpc.consumer.payment.completeSetup.mutationOptions());
  const [adding, setAdding] = useState(false);

  const add = async (): Promise<PaymentMethodSummary | null> => {
    setAdding(true);
    try {
      const session = await start.mutateAsync();
      const result = await presentSheet(session);
      if (result.status === "canceled") return null;
      if (result.status === "failed") {
        Alert.alert("支払い方法を登録できませんでした", result.message);
        return null;
      }
      const method = await complete.mutateAsync({
        setupIntentClientSecret: session.setupIntentClientSecret,
      });
      await queryClient.invalidateQueries(trpc.consumer.payment.listMethods.pathFilter());
      return method;
    } catch (e) {
      Alert.alert("支払い方法を登録できませんでした", e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setAdding(false);
    }
  };

  return { add, adding };
}

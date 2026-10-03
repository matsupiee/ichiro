import { StripeProvider as NativeStripeProvider, useStripe } from "@stripe/stripe-react-native";
import * as Linking from "expo-linking";
import { type ReactNode, useEffect } from "react";

import { APPLE_MERCHANT_ID, APP_URL_SCHEME, STRIPE_PUBLISHABLE_KEY } from "@/lib/stripe-config";

// 本人認証のあとにブラウザから戻ってきた URL を Stripe に渡す
function UrlHandler() {
  const { handleURLCallback } = useStripe();
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      handleURLCallback(url);
    });
    return () => sub.remove();
  }, [handleURLCallback]);
  return null;
}

export function StripeProvider({ children }: { children: ReactNode }) {
  return (
    <NativeStripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={APPLE_MERCHANT_ID}
      urlScheme={APP_URL_SCHEME}
    >
      <>
        <UrlHandler />
        {children}
      </>
    </NativeStripeProvider>
  );
}

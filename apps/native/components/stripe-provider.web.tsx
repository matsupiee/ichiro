import type { ReactNode } from "react";

// Stripe の React Native SDK は Web に対応していないので、Web では何もしない
export function StripeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

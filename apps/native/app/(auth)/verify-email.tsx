import { Redirect, useLocalSearchParams } from "expo-router";
import { VerifyEmail } from "@/components/verify-email";
export default function VerifyEmailScreen() {
  const { email, sent, deliveryFailed } = useLocalSearchParams<{
    email?: string;
    sent?: string;
    deliveryFailed?: string;
  }>();
  if (!email) return <Redirect href="/sign-in" />;
  return (
    <VerifyEmail email={email} sent={sent === "true"} deliveryFailed={deliveryFailed === "true"} />
  );
}

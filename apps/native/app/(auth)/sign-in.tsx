import { useLocalSearchParams } from "expo-router";

import { AuthForm } from "@/components/auth-form";
import { authErrorMessage } from "@/lib/auth-error";

export default function SignInScreen() {
  const { email, reason } = useLocalSearchParams<{ email?: string; reason?: string }>();
  return (
    <AuthForm
      mode="sign-in"
      initialEmail={email}
      initialError={
        reason === "already-registered"
          ? authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })
          : null
      }
    />
  );
}

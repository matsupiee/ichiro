import { Redirect, Stack, usePathname } from "expo-router";

import { authClient } from "@/lib/auth-client";

import { colors } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "welcome",
};

export default function AuthLayout() {
  const { data: session } = authClient.useSession();
  const path = usePathname();
  if (session?.user && !session.user.emailVerified && path !== "/verify-email") {
    return <Redirect href={{ pathname: "/verify-email", params: { email: session.user.email } }} />;
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}

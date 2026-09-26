import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "welcome",
};

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}

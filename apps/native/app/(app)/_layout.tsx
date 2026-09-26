import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ animation: "fade" }} />
      <Stack.Screen name="commitments/new" />
      <Stack.Screen name="commitments/[id]" />
    </Stack>
  );
}

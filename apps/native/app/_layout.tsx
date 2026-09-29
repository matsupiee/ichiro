import "@/global.css";
import { DelaGothicOne_400Regular, useFonts } from "@expo-google-fonts/dela-gothic-one";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Uniwind } from "uniwind";

import { CelebrationProvider } from "@/components/celebration/celebration";
import { StripeProvider } from "@/components/stripe-provider";
import { authClient } from "@/lib/auth-client";
import { colors } from "@/lib/theme";
import { queryClient } from "@/utils/trpc";

// デザインはライトテーマのみ
Uniwind.setTheme("light");
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { data: session, isPending } = authClient.useSession();
  const [fontsLoaded] = useFonts({ DelaGothicOne_400Regular });
  const ready = !isPending && fontsLoaded;
  const router = useRouter();

  useEffect(() => {
    if (!ready || !session?.user) return;
    let active = true;
    void (async () => {
      const token = await SecureStore.getItemAsync("pending-checker-invitation");
      if (!token || !active) return;
      await SecureStore.deleteItemAsync("pending-checker-invitation");
      if (active) router.replace({ pathname: "/invite/[token]", params: { token } });
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [ready, session?.user.id, router]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  const signedIn = !!session?.user;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="invite/[token]" />
    </Stack>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <HeroUINativeProvider>
            <BottomSheetModalProvider>
              <StripeProvider>
                <CelebrationProvider>
                  <StatusBar style="dark" />
                  <RootNavigator />
                </CelebrationProvider>
              </StripeProvider>
            </BottomSheetModalProvider>
          </HeroUINativeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

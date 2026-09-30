import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/brand-gradient";
import { Dog } from "@/components/dog/dog";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [jumping, setJumping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ワンちゃんをタップすると少しのあいだ跳ねる
  const tapDog = () => {
    haptics.tap();
    setJumping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJumping(false), 1600);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 bg-canvas px-[30px]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}
    >
      <View className="flex-1 items-center justify-center gap-1.5">
        <Pressable accessibilityLabel="ワンちゃん" onPress={tapDog}>
          <Dog size={210} mood={jumping ? "jump" : "idle"} />
        </Pressable>
        <BrandLogo size={56} style={{ marginTop: 10 }} />
        <Text className="text-center text-[16px] leading-[27px] text-mute">
          {"目標を宣言して、毎日の達成を報告しよう。\nがんばった日は、ボクがお祝いするワン。"}
        </Text>
      </View>
      <View className="gap-3.5">
        <PrimaryButton label="アカウントを作る" onPress={() => router.push("/sign-up")} />
        <SecondaryButton label="ログイン" onPress={() => router.push("/sign-in")} />
      </View>
    </Animated.View>
  );
}

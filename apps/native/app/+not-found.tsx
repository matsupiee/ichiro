import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Dog } from "@/components/dog/dog";
import { PrimaryButton } from "@/components/ui";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-canvas px-[30px]">
      <Dog size={140} />
      <Text className="text-[17px] font-bold text-ink">ページが見つからないワン</Text>
      <View className="w-full pt-4">
        <PrimaryButton label="ホームへ" onPress={() => router.replace("/")} />
      </View>
    </View>
  );
}

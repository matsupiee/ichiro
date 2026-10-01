import { Image } from "react-native";

import { colors } from "@/lib/theme";

// 添付されたブランド画像の筆記体と飾り線を、一つのロゴとして表示する。
export function BrandLogo({ width = 150 }: { width?: number }) {
  return (
    <Image
      source={require("../assets/images/ichiro-wordmark.png")}
      accessibilityLabel="ichiro"
      accessibilityRole="image"
      resizeMode="contain"
      style={{ width, height: width / 3, tintColor: colors.brand }}
    />
  );
}

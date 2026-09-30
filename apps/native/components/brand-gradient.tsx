import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

import { brandGradient, fonts } from "@/lib/theme";

export function BrandGradientDefinition({ id, width }: { id: string; width?: number }) {
  return (
    <Defs>
      <LinearGradient
        id={id}
        x1="0%"
        y1="0%"
        x2={width ?? "100%"}
        y2="0%"
        gradientUnits={width ? "userSpaceOnUse" : "objectBoundingBox"}
      >
        {brandGradient.map((color, index) => (
          <Stop key={color} offset={index / (brandGradient.length - 1)} stopColor={color} />
        ))}
      </LinearGradient>
    </Defs>
  );
}

// 装飾レイヤーがボタンのタップや読み上げを妨げないようにする。
export function BrandGradient({ radius = 0 }: { radius?: number }) {
  const id = useId();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
    >
      <Svg width="100%" height="100%" accessible={false}>
        <BrandGradientDefinition id={id} />
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function BrandLogo({ size = 38, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const id = useId();
  return (
    <View accessible accessibilityRole="text" accessibilityLabel="ichiro" style={style}>
      <Svg width={(size * 186) / 56} height={size * 1.15} viewBox="0 0 186 64.4" accessible={false}>
        <BrandGradientDefinition id={id} />
        <SvgText
          x="0"
          y="51"
          fontFamily={fonts.logo}
          fontSize={56}
          letterSpacing={-1}
          fill={`url(#${id})`}
        >
          ichiro
        </SvgText>
      </Svg>
    </View>
  );
}

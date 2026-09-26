import { useEffect } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { colors } from "@/lib/theme";

const SIZE = 900;
const C = SIZE / 2;
// CSS の radial-gradient(circle) は一番遠い角までを 100% とする
const R = C * Math.SQRT2;

function wedge(fromDeg: number, toDeg: number) {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${C + Math.cos(rad) * R} ${C + Math.sin(rad) * R}`;
  };
  return `M ${C} ${C} L ${p(fromDeg)} A ${R} ${R} 0 0 1 ${p(toDeg)} Z`;
}

// 30度ごとに10度幅のピンクの光線。中心から外へ向けて消えていく
const WEDGES = Array.from({ length: 12 }, (_, i) => wedge(i * 30, i * 30 + 10));

export function Rays({ centerY }: { centerY: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(360, { duration: 26000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(r);
  }, [r]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));

  return (
    <Animated.View
      style={[
        {
          pointerEvents: "none",
          position: "absolute",
          left: "50%",
          top: centerY,
          width: SIZE,
          height: SIZE,
          marginLeft: -C,
          marginTop: -C,
        },
        spin,
      ]}
    >
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <RadialGradient id="fade" cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
            <Stop offset="0.18" stopColor={colors.pinkRay} stopOpacity={1} />
            <Stop offset="0.52" stopColor={colors.pinkRay} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {WEDGES.map((d, i) => (
          <Path key={i} d={d} fill="url(#fade)" />
        ))}
      </Svg>
    </Animated.View>
  );
}

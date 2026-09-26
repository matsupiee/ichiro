import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";

// ichiro の愛犬をモチーフにしたキャラクター（デザインの 1a / original）。
// 200×200 の座標で組み立て、size に合わせて拡大縮小する。

export type DogMood = "idle" | "jump";

const palette = {
  body: "#F2E3C6",
  tail: "#ECD3A6",
  head: "#F7ECD7",
  ear: "#EDD6AE",
  foot: "#FAF1E0",
  muzzle: "#FFF9EF",
  eye: "#1E1A18",
  noseShine: "#5A524C",
};

const inOut = Easing.inOut(Easing.ease);

// 0 → 1 → 0 を ease-in-out でくり返す（CSS の 0%,100% / 50% のキーフレームと同じ動き）
function usePingPong(duration: number): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withRepeat(withTiming(1, { duration: duration / 2, easing: inOut }), -1, true);
    return () => cancelAnimation(v);
  }, [duration, v]);
  return v;
}

// 0 → 1 を一定の速さでくり返す。キーフレームを interpolate で当てる用
function useLoop(duration: number): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(v);
  }, [duration, v]);
  return v;
}

function Oval({
  left,
  top,
  width,
  height,
  color,
  style,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ position: "absolute", left, top, width, height }, style]}>
      <Svg width={width} height={height}>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={color} />
      </Svg>
    </View>
  );
}

function Eye({ left }: { left: number }) {
  const t = useLoop(4000);
  const blink = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(t.value, [0, 0.9, 0.95, 1], [1, 1, 0.1, 1]) }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          top: 74,
          width: 18,
          height: 20,
          borderRadius: 10,
          backgroundColor: palette.eye,
          overflow: "hidden",
        },
        blink,
      ]}
    >
      <View
        style={{
          position: "absolute",
          right: "18%",
          top: "14%",
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: "#fff",
        }}
      />
    </Animated.View>
  );
}

function DogFigure({ mood }: { mood: DogMood }) {
  const jump = mood === "jump";
  const hop = useLoop(800);
  const bob = usePingPong(2400);
  const wag = usePingPong(jump ? 220 : 600);
  const ear = usePingPong(jump ? 400 : 2400);
  const tilt = usePingPong(jump ? 800 : 3000);

  const bodyStyle = useAnimatedStyle(() => {
    if (!jump) {
      return { transform: [{ translateY: -5 * bob.value }, { scaleX: 1 }, { scaleY: 1 }] };
    }
    const k = [0, 0.12, 0.4, 0.62, 0.78, 1];
    return {
      transform: [
        { translateY: interpolate(hop.value, k, [0, 0, -54, 0, 0, 0]) },
        { scaleX: interpolate(hop.value, k, [1, 1.1, 0.94, 1.08, 0.98, 1]) },
        { scaleY: interpolate(hop.value, k, [1, 0.88, 1.08, 0.9, 1.02, 1]) },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    if (!jump) return { opacity: 0.16, transform: [{ scale: 1 }] };
    const k = [0, 0.12, 0.4, 0.62, 1];
    return {
      opacity: interpolate(hop.value, k, [0.16, 0.16, 0.06, 0.16, 0.16]),
      transform: [{ scale: interpolate(hop.value, k, [1, 1, 0.55, 1, 1]) }],
    };
  });

  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(wag.value, [0, 1], [-24, 26])}deg` }],
  }));
  const earLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(ear.value, [0, 1], [12, 44])}deg` }],
  }));
  const earRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(ear.value, [0, 1], [-12, -44])}deg` }],
  }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(tilt.value, [0, 1], [-5, 5])}deg` }],
  }));

  return (
    <>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 48,
            top: 180,
            width: 104,
            height: 14,
            borderRadius: 52,
            backgroundColor: "#000",
          },
          shadowStyle,
        ]}
      />
      <Animated.View
        style={[{ position: "absolute", inset: 0, transformOrigin: "100px 190px" }, bodyStyle]}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 134,
              top: 98,
              width: 48,
              height: 48,
              transformOrigin: "10% 90%",
            },
            tailStyle,
          ]}
        >
          <Svg width={48} height={48}>
            <Path
              d="M 11.27 11.27 A 18 18 0 0 1 36.73 36.73"
              stroke={palette.tail}
              strokeWidth={12}
              fill="none"
            />
          </Svg>
        </Animated.View>
        <View
          style={{
            position: "absolute",
            left: 38,
            top: 106,
            width: 124,
            height: 80,
            borderTopLeftRadius: 44,
            borderTopRightRadius: 44,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            backgroundColor: palette.body,
          }}
        />
        <Oval left={58} top={168} width={34} height={22} color={palette.foot} />
        <Oval left={108} top={168} width={34} height={22} color={palette.foot} />

        <Animated.View
          style={[{ position: "absolute", inset: 0, transformOrigin: "100px 130px" }, headStyle]}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 20,
                top: 46,
                width: 44,
                height: 68,
                transformOrigin: "90% 8%",
              },
              earLStyle,
            ]}
          >
            <Oval left={0} top={0} width={44} height={68} color={palette.ear} />
          </Animated.View>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 136,
                top: 46,
                width: 44,
                height: 68,
                transformOrigin: "10% 8%",
              },
              earRStyle,
            ]}
          >
            <Oval left={0} top={0} width={44} height={68} color={palette.ear} />
          </Animated.View>
          <Oval left={38} top={28} width={124} height={112} color={palette.head} />
          <Eye left={68} />
          <Eye left={114} />
          <Oval left={74} top={94} width={52} height={38} color={palette.muzzle} />
          <View
            style={{
              position: "absolute",
              left: 88,
              top: 96,
              width: 24,
              height: 16,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
              backgroundColor: palette.eye,
            }}
          >
            <View
              style={{
                position: "absolute",
                left: "22%",
                top: "18%",
                width: "30%",
                height: "26%",
                borderRadius: 4,
                backgroundColor: palette.noseShine,
              }}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

export function Dog({ size = 200, mood = "idle" }: { size?: number; mood?: DogMood }) {
  return (
    <View style={{ width: size, height: size, pointerEvents: "none" }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 200,
          height: 200,
          transformOrigin: "0px 0px",
          transform: [{ scale: size / 200 }],
        }}
      >
        {/* mood が変わったらアニメーションを最初からやり直す */}
        <DogFigure key={mood} mood={mood} />
      </View>
    </View>
  );
}

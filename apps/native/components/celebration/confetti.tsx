import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const COLORS = ["#FF5CF2", "#FFC800", "#4DD8FF", "#58E08A", "#FF8A4C", "#B67CFF"];
const easing = Easing.bezier(0.15, 0.6, 0.35, 1);

type Piece = {
  width: number;
  height: number;
  color: string;
  round: boolean;
  dx: number;
  up: number;
  dy: number;
  rotate: number;
  duration: number;
  delay: number;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 90 + Math.random() * 170;
    return {
      width: 7 + Math.random() * 7,
      height: 10 + Math.random() * 10,
      color: COLORS[i % COLORS.length]!,
      round: i % 3 === 0,
      dx: Math.cos(angle) * radius,
      up: -70 - Math.random() * 150,
      dy: 200 + Math.random() * 380,
      rotate: Math.random() * 900 - 450,
      duration: 1500 + Math.random() * 900,
      delay: 550 + Math.random() * 250,
    };
  });
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing }));
  }, [piece, t]);

  const style = useAnimatedStyle(() => {
    const k = [0, 0.2, 1];
    return {
      opacity: interpolate(t.value, k, [1, 1, 0]),
      transform: [
        { translateX: interpolate(t.value, k, [0, piece.dx * 0.5, piece.dx]) },
        { translateY: interpolate(t.value, k, [0, piece.up, piece.dy]) },
        { rotate: `${interpolate(t.value, k, [0, piece.rotate * 0.3, piece.rotate])}deg` },
        { scale: interpolate(t.value, k, [0.3, 1, 1]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: piece.width,
          height: piece.height,
          borderRadius: piece.round ? piece.width : 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

// 画面の横中央・上から34%の位置から紙吹雪を飛ばす
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(() => makePieces(count), [count]);
  return (
    <View style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
      <View style={{ position: "absolute", left: "50%", top: "34%" }}>
        {pieces.map((p, i) => (
          <ConfettiPiece key={i} piece={p} />
        ))}
      </View>
    </View>
  );
}

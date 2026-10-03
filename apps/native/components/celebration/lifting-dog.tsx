import { useEffect, useState } from "react";
import { type ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const FRAMES: ImageSourcePropType[] = [
  require("@/assets/images/celebration/dog-lift-1.png"),
  require("@/assets/images/celebration/dog-lift-2.png"),
  require("@/assets/images/celebration/dog-lift-3.png"),
];
const SEQUENCE = [0, 1, 2, 1];

function Frame({
  source,
  index,
  progress,
  onLoad,
}: {
  source: ImageSourcePropType;
  index: number;
  progress: SharedValue<number>;
  onLoad: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: SEQUENCE[Math.floor(progress.value) % SEQUENCE.length] === index ? 1 : 0,
  }));

  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      onLoad={onLoad}
      style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }, style]}
    />
  );
}

export function LiftingDog({ size }: { size: number }) {
  const progress = useSharedValue(0);
  const [loaded, setLoaded] = useState(0);

  // Decode all three local images before starting so frame changes never show a blank image.
  useEffect(() => {
    if (loaded !== 0b111) return;
    progress.value = withRepeat(
      withTiming(SEQUENCE.length, { duration: 1200, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [loaded, progress]);

  return (
    <View style={{ width: size, height: size }} testID="achievement-dog-animation">
      {FRAMES.map((source, index) => (
        <Frame
          key={index}
          source={source}
          index={index}
          progress={progress}
          onLoad={() => setLoaded((value) => value | (1 << index))}
        />
      ))}
    </View>
  );
}

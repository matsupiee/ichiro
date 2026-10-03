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

import { type AchievementAnimation } from "@/lib/achievement-animation";

const ANIMATIONS: Record<
  AchievementAnimation,
  { frames: ImageSourcePropType[]; sequence: number[] }
> = {
  lifting: {
    frames: [
      require("@/assets/images/celebration/dog-lift-1.png"),
      require("@/assets/images/celebration/dog-lift-2.png"),
      require("@/assets/images/celebration/dog-lift-3.png"),
    ],
    sequence: [0, 1, 2, 1],
  },
  studying: {
    frames: [
      require("@/assets/images/celebration/dog-study-1.png"),
      require("@/assets/images/celebration/dog-study-2.png"),
      require("@/assets/images/celebration/dog-study-3.png"),
      require("@/assets/images/celebration/dog-study-4.png"),
    ],
    sequence: [0, 1, 2, 3],
  },
};

function Frame({
  source,
  index,
  progress,
  sequence,
  onLoad,
}: {
  source: ImageSourcePropType;
  index: number;
  progress: SharedValue<number>;
  sequence: number[];
  onLoad: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: sequence[Math.floor(progress.value) % sequence.length] === index ? 1 : 0,
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

export function AchievementDog({ size, variant }: { size: number; variant: AchievementAnimation }) {
  const { frames, sequence } = ANIMATIONS[variant];
  const progress = useSharedValue(0);
  const [loaded, setLoaded] = useState(0);

  // Only mount frames from the chosen version, and decode them before starting the loop.
  useEffect(() => {
    if (loaded !== (1 << frames.length) - 1) return;
    progress.value = withRepeat(
      withTiming(sequence.length, { duration: 1200, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [loaded, progress, frames.length, sequence.length]);

  return (
    <View style={{ width: size, height: size }} testID="achievement-dog-animation">
      <View style={StyleSheet.absoluteFill} testID={`achievement-dog-${variant}`}>
        {frames.map((source, index) => (
          <Frame
            key={index}
            source={source}
            index={index}
            progress={progress}
            sequence={sequence}
            onLoad={() => setLoaded((value) => value | (1 << index))}
          />
        ))}
      </View>
    </View>
  );
}

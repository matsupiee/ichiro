import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

import { Dog } from "@/components/dog/dog";
import { PrimaryButton } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, fonts } from "@/lib/theme";

import { Confetti } from "./confetti";
import { Rays } from "./rays";

// 達成を報告したとき・コミットメントを作ったときに出す Duolingo 風のお祝い。
// ワンちゃんが下から跳ねて出てきて、紙吹雪とバイブで祝福する。

export type Tile = { label: string; value: string };

export type CelebrationInput = {
  closeLabel?: string;
  title?: string;
  message: string;
  tiles: [Tile] | [Tile, Tile];
};

type CelebrationState = CelebrationInput & { id: number };

const CelebrationContext = createContext<(input: CelebrationInput) => void>(() => {});

export function useCelebrate() {
  return useContext(CelebrationContext);
}

const easeOut = Easing.out(Easing.ease);

function useRiseIn(delay: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 450, easing: easeOut }));
  }, [delay, t]);
  return useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 28 }],
  }));
}

function useCountUp(delay: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 400, easing: easeOut }));
  }, [delay, t]);
  return useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [0, 0.4, 1], [1, 1.35, 1]) }],
  }));
}

const TILE_COLORS = [
  { frame: colors.pink, value: colors.pink },
  { frame: colors.amber, value: colors.amberDeep },
];

function TileCard({ tile, index }: { tile: Tile; index: number }) {
  const rise = useRiseIn(750 + index * 100);
  const count = useCountUp(1200 + index * 150);
  const c = TILE_COLORS[index]!;
  return (
    <Animated.View
      style={[
        {
          flex: 1,
          borderWidth: 3,
          borderColor: c.frame,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: c.frame,
        },
        rise,
      ]}
    >
      <Text className="py-1.5 text-center text-[14px] font-extrabold text-white">{tile.label}</Text>
      <View className="rounded-[18px] bg-white py-3.5">
        <Animated.Text
          style={[{ textAlign: "center", fontSize: 28, fontWeight: "900", color: c.value }, count]}
        >
          {tile.value}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

function CelebrationOverlay({ cel, onClose }: { cel: CelebrationState; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => haptics.celebrate(), []);

  const enter = useSharedValue(0);
  const buzz = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 700, easing: Easing.bezier(0.3, 1.2, 0.5, 1) });
    buzz.value = withDelay(
      620,
      withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }),
    );
  }, [enter, buzz]);

  const dogEnter = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(enter.value, [0, 0.6, 0.8, 1], [420, -24, 6, 0]) }],
  }));
  // 着地の瞬間に画面ごと揺らす
  const shake = useAnimatedStyle(() => {
    const k = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1];
    return {
      transform: [
        { translateX: interpolate(buzz.value, k, [0, -7, 6, -5, 4, -2, 0]) },
        { rotate: `${interpolate(buzz.value, k, [0, -1, 1, 0, 0, 0, 0])}deg` },
      ],
    };
  });

  const titleRise = useRiseIn(500);
  const messageRise = useRiseIn(600);
  const buttonRise = useRiseIn(1000);

  // デザインは status bar 込みで上から 80px、下から 46px
  const top = insets.top + 26;
  const bottom = insets.bottom + 12;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      <Rays centerY={top + 220} />
      <Animated.View
        style={[
          {
            position: "absolute",
            inset: 0,
            alignItems: "center",
            paddingTop: top,
            paddingBottom: bottom,
            paddingHorizontal: 28,
            zIndex: 2,
          },
          shake,
        ]}
      >
        <Animated.View style={[{ marginTop: 60 }, dogEnter]}>
          <Pressable accessibilityLabel="ワンちゃん" onPress={haptics.tap}>
            <Dog size={230} mood="jump" />
          </Pressable>
        </Animated.View>
        {cel.title ? (
          <Animated.Text
            style={[
              { fontFamily: fonts.logo, fontSize: 40, color: colors.pink, marginTop: 18 },
              titleRise,
            ]}
          >
            {cel.title}
          </Animated.Text>
        ) : null}
        <Animated.Text
          style={[
            {
              fontSize: 17,
              fontWeight: "700",
              color: colors.ink2,
              marginTop: 22,
              textAlign: "center",
            },
            messageRise,
          ]}
        >
          {cel.message}
        </Animated.Text>
        <View style={{ flexDirection: "row", gap: 12, width: "100%", marginTop: 28 }}>
          {cel.tiles.map((tile, i) => (
            <TileCard key={tile.label} tile={tile} index={i} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Animated.View style={[{ width: "100%", gap: 14 }, buttonRise]}>
          <PrimaryButton
            label={cel.closeLabel ?? "つづける"}
            onPress={() => {
              haptics.select();
              onClose();
            }}
          />
        </Animated.View>
      </Animated.View>
      <Confetti count={60} />
    </Animated.View>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [cel, setCel] = useState<CelebrationState | null>(null);
  const celebrate = useCallback(
    (input: CelebrationInput) => setCel({ ...input, id: Date.now() }),
    [],
  );
  const close = useCallback(() => setCel(null), []);
  const value = useMemo(() => celebrate, [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {cel ? (
          Platform.OS === "ios" ? (
            <FullWindowOverlay>
              <CelebrationOverlay key={cel.id} cel={cel} onClose={close} />
            </FullWindowOverlay>
          ) : (
            <Modal transparent visible animationType="fade" onRequestClose={close}>
              <CelebrationOverlay key={cel.id} cel={cel} onClose={close} />
            </Modal>
          )
        ) : null}
      </View>
    </CelebrationContext.Provider>
  );
}

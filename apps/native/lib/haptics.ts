import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Web には振動がないので何もしない
const enabled = Platform.OS !== "web";

function run(fn: () => Promise<void>) {
  if (enabled) fn().catch(() => {});
}

export const haptics = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => run(() => Haptics.selectionAsync()),
  // お祝いのバイブ。キャラが飛び出すときに軽く2回、着地して画面が揺れるときに強めに鳴らす
  celebrate: () => {
    if (!enabled) return () => {};
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => Promise<void>) => timers.push(setTimeout(() => run(fn), ms));
    at(0, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    at(45, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    at(620, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    at(730, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    at(830, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    at(900, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    return () => timers.forEach(clearTimeout);
  },
};

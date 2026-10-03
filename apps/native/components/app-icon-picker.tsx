import { useEffect, useRef, useState } from "react";
import { AppState, Image, Pressable, Text, View } from "react-native";

import { ErrorText } from "@/components/ui";
import AppIcon, { type AppIconName } from "@/modules/app-icon";
import { colors } from "@/lib/theme";

const choices = [
  { name: "blue", label: "青", image: require("@/assets/images/app-icons/blue.jpg") },
  { name: "purple", label: "紫", image: require("@/assets/images/app-icons/purple.jpg") },
  { name: "pink", label: "ピンク", image: require("@/assets/images/app-icons/pink.jpg") },
] as const;

export function AppIconPicker() {
  const [selected, setSelected] = useState<AppIconName | null>(null);
  const [busy, setBusy] = useState(false);
  const changing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!AppIcon) return;
      try {
        const name = await AppIcon.getIcon();
        if (active) {
          setSelected(name);
          setError(null);
        }
      } catch {
        if (active) setError("現在のアイコンを読み込めませんでした。画面を開き直してください。");
      }
    };
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !changing.current) void refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const change = async (name: AppIconName) => {
    if (!AppIcon || changing.current || name === selected) return;
    changing.current = true;
    setBusy(true);
    setError(null);
    try {
      await AppIcon.setIcon(name);
      setSelected(await AppIcon.getIcon());
    } catch {
      setError("アイコンを変更できませんでした。もう一度お試しください。");
    } finally {
      changing.current = false;
      setBusy(false);
    }
  };

  return (
    <View className="mx-[30px]">
      <View className="flex-row gap-3">
        {choices.map((choice) => (
          <Pressable
            key={choice.name}
            testID={`app-icon-${choice.name}`}
            accessibilityRole="radio"
            accessibilityLabel={`${choice.label}のアプリアイコン`}
            accessibilityState={{
              checked: selected === choice.name,
              disabled: busy || !AppIcon || !selected,
            }}
            disabled={busy || !AppIcon || !selected}
            onPress={() => void change(choice.name)}
            className="flex-1 items-center rounded-[20px] px-2 py-3"
            style={{
              backgroundColor: colors.field,
              borderWidth: 2,
              borderColor: selected === choice.name ? colors.brand : "transparent",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Image source={choice.image} style={{ width: 64, height: 64, borderRadius: 14 }} />
            <Text className="pt-2 text-[15px] text-ink">{choice.label}</Text>
            <Text className="pt-1 text-[12px] text-mute">
              {selected === choice.name ? "選択中" : choice.name === "blue" ? "デフォルト" : " "}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="pt-3 text-[13px] text-mute" accessibilityLiveRegion="polite">
        {busy
          ? "アイコンを変更しています…"
          : `この端末のホーム画面に表示するアイコンです。${selected ? `現在：${choices.find((choice) => choice.name === selected)?.label}` : ""}`}
      </Text>
      {!AppIcon ? <ErrorText message="アイコンの変更には最新版のアプリが必要です。" /> : null}
      <ErrorText message={error} />
    </View>
  );
}

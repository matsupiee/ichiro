import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, ErrorText } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { colors } from "@/lib/theme";
import { queryClient, trpc } from "@/utils/trpc";

const notices = [
  "退会は取り消せません。",
  "退会後は、このアカウントでログインできなくなります。",
  "退会すると、新しい罰金の請求と未払い分の再請求が停止します。",
  "退会前に開始した決済は、退会後に完了する場合があります。",
  "すでに決済済みの罰金は、退会による返金の対象にはなりません。",
];

export function WithdrawalSheet({
  onBack,
  onBusyChange,
}: {
  onBack: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [acknowledged, setAcknowledged] = useState(false);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation(trpc.consumer.account.withdraw.mutationOptions());
  const submit = async () => {
    if (!acknowledged || working.current) return;
    working.current = true;
    onBusyChange(true);
    setBusy(true);
    setError(null);
    try {
      await mutation.mutateAsync({ acknowledged: true });
      // サーバーで全セッションは失効済み。端末の認証状態も更新する。
      const signOut = await authClient.signOut();
      if (signOut.error) {
        await authClient.getSession({ query: { disableCookieCache: true } });
      }
      queryClient.clear();
      Alert.alert("退会しました", "ご利用ありがとうございました。");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "通信環境を確認して、もう一度お試しください",
      );
    } finally {
      working.current = false;
      onBusyChange(false);
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 pt-1.5">
        <BackButton
          onPress={() => {
            if (!busy) onBack();
          }}
        />
        <Text className="text-[24px] font-extrabold text-ink">ichiro の退会</Text>
        <View className="w-12" />
      </View>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Text className="pb-10 pt-12 text-center text-[21px] font-semibold leading-8 text-ink">
          ichiro を退会しますか？
        </Text>
        <Text className="pb-4 text-[17px] text-ink">注意事項</Text>
        <View className="gap-5 rounded-[28px] bg-white px-6 py-7">
          {notices.map((notice) => (
            <View key={notice} className="flex-row gap-3">
              <Text className="text-[17px] leading-7 text-ink">•</Text>
              <Text className="flex-1 text-[17px] leading-7 text-ink">{notice}</Text>
            </View>
          ))}
        </View>
        <ErrorText message={error} />
      </BottomSheetScrollView>
      <View
        style={{
          padding: 24,
          paddingBottom: insets.bottom + 20,
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="注意事項を確認しました"
          accessibilityState={{ checked: acknowledged, disabled: busy }}
          disabled={busy}
          onPress={() => setAcknowledged((value) => !value)}
          className="min-h-14 flex-row items-center gap-4 pb-4"
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderWidth: 2,
              borderColor: acknowledged ? colors.ink : colors.mute,
              borderRadius: 6,
              backgroundColor: acknowledged ? colors.ink : colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.white, fontSize: 19 }}>{acknowledged ? "✓" : ""}</Text>
          </View>
          <Text className="flex-1 text-[17px] text-ink">注意事項を確認しました</Text>
        </Pressable>
        <Pressable
          testID="confirm-withdrawal"
          accessibilityRole="button"
          accessibilityLabel="退会"
          accessibilityState={{ disabled: !acknowledged || busy }}
          disabled={!acknowledged || busy}
          onPress={() => void submit()}
          style={{
            minHeight: 60,
            borderRadius: 30,
            backgroundColor: acknowledged ? "#D93646" : colors.field,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: acknowledged ? colors.white : colors.mute,
              }}
            >
              退会
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

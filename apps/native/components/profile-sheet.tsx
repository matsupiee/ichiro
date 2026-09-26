import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import { forwardRef, useCallback, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { Chevron, ErrorText, RowButton } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import type { useAvatar } from "@/lib/avatar";
import { colors, shadows } from "@/lib/theme";
import { queryClient } from "@/utils/trpc";

const MENU = ["利用規約", "プライバシーポリシー", "問い合わせ・報告"];

function SectionLabel({ children, top = 22 }: { children: string; top?: number }) {
  return (
    <Text className="px-[54px] pb-2.5 text-[17px] text-ink" style={{ paddingTop: top }}>
      {children}
    </Text>
  );
}

function NameModal({
  visible,
  initial,
  onClose,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = draft.trim();
    if (!name) {
      setError("名前を入力してください");
      return;
    }
    setSaving(true);
    const { error: e } = await authClient.updateUser({ name });
    setSaving(false);
    if (e) {
      setError(e.message ?? "保存できませんでした");
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={() => {
        setDraft(initial);
        setError(null);
      }}
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="absolute inset-0 bg-black/20" />
      <Animated.View
        entering={ZoomIn.duration(250)}
        className="absolute left-[22px] right-[22px] top-[170px] rounded-[36px] px-[18px] pb-[18px] pt-7"
        style={{ backgroundColor: "#F2F2F2", boxShadow: shadows.modal }}
      >
        <Text className="px-3 text-[20px] font-extrabold text-ink">名前を編集</Text>
        <Text className="px-3 pb-4 pt-1.5 text-[15px] text-mute">名前を入力してください</Text>
        <View
          className="min-h-[62px] flex-row items-center rounded-[28px] px-[22px]"
          style={{ backgroundColor: "#DCDCDC" }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoFocus
            selectionColor={colors.pink}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{ flex: 1, fontSize: 18, color: colors.ink, paddingVertical: 18 }}
          />
        </View>
        <ErrorText message={error} />
        <View className="flex-row gap-2.5 pt-[18px]">
          <Pressable
            onPress={onClose}
            className="h-[54px] flex-1 items-center justify-center rounded-[27px]"
            style={{ backgroundColor: "#DCDCDC" }}
          >
            <Text className="text-[17px] font-bold text-ink">キャンセル</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={saving}
            className="h-[54px] flex-1 items-center justify-center rounded-[27px] bg-pink"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            <Text className="text-[17px] font-bold text-white">保存</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

type Props = { avatar: ReturnType<typeof useAvatar> };

// 右上のプロフィールアイコンから開くアカウントのシート
export const ProfileSheet = forwardRef<BottomSheetModal, Props>(function ProfileSheet(
  { avatar },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const [photoMenu, setPhotoMenu] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  const close = () => {
    if (ref && "current" in ref) ref.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.18}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["100%"]}
      topInset={insets.top + 6}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={() => setPhotoMenu(false)}
      backgroundStyle={{ backgroundColor: colors.canvas, borderRadius: 44 }}
      handleIndicatorStyle={{ width: 40, height: 5, backgroundColor: "#D1D1D6" }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View className="flex-row items-center justify-between px-6 pt-1.5">
          <View className="w-11" />
          <Text className="text-[24px] font-extrabold text-ink">アカウント</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            onPress={close}
            className="h-11 w-11 items-center justify-center rounded-full bg-field"
          >
            <Text className="text-[18px] text-ink-2">✕</Text>
          </Pressable>
        </View>

        <SectionLabel top={26}>プロフィール写真</SectionLabel>
        <View style={{ zIndex: 5 }}>
          <Pressable
            onPress={() => setPhotoMenu((v) => !v)}
            className="mx-[30px] min-h-16 flex-row items-center justify-between rounded-[36px] bg-field py-3 pl-[26px] pr-[22px]"
          >
            <Avatar uri={avatar.uri} size={44} placeholderColor={colors.line} />
            <Chevron />
          </Pressable>
          {photoMenu ? (
            <Animated.View
              entering={ZoomIn.duration(250)}
              className="absolute left-20 right-20 top-[78px] gap-2.5 rounded-[32px] px-4 pb-4 pt-[18px]"
              style={{ backgroundColor: "rgba(246,246,246,0.97)", boxShadow: shadows.popover }}
            >
              <Text className="pb-1 text-center text-[17px] text-ink">プロフィール写真</Text>
              <Pressable
                onPress={() => {
                  setPhotoMenu(false);
                  avatar.pick();
                }}
                className="h-[50px] items-center justify-center rounded-[25px] bg-field"
              >
                <Text className="text-[17px] font-semibold text-ink">写真を選択</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPhotoMenu(false);
                  avatar.remove();
                }}
                className="h-[50px] items-center justify-center rounded-[25px] bg-field"
              >
                <Text className="text-[17px] font-semibold text-alert">削除</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>

        <SectionLabel>名前</SectionLabel>
        <RowButton onPress={() => setNameOpen(true)}>
          <Text className="text-[18px] text-ink">{session?.user.name}</Text>
        </RowButton>

        <SectionLabel>支払い情報</SectionLabel>
        <RowButton>
          <Text className="text-[17px] text-ink">Visa •••• 4242</Text>
        </RowButton>

        <View className="gap-2.5 pt-8">
          {MENU.map((m) => (
            <RowButton key={m}>
              <Text className="text-[17px] text-ink">{m}</Text>
            </RowButton>
          ))}
        </View>

        <View className="pt-8">
          <RowButton
            showChevron={false}
            onPress={async () => {
              close();
              await authClient.signOut();
              queryClient.clear();
            }}
          >
            <Text className="text-[17px] text-ink">ログアウト</Text>
          </RowButton>
        </View>

        <Text className="pt-7 text-center text-[13px] text-faint">
          Version {Constants.expoConfig?.version}
        </Text>
      </BottomSheetScrollView>

      <NameModal
        visible={nameOpen}
        initial={session?.user.name ?? ""}
        onClose={() => setNameOpen(false)}
      />
    </BottomSheetModal>
  );
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { colors } from "@/lib/theme";
import { localToday } from "@/lib/date";
import { ENV } from "@/src/env";
import { trpc } from "@/utils/trpc";

type Props = {
  id: string;
  visible: boolean;
  onClose: () => void;
  onSaved?: (name: string) => void;
};

// 作成後のお祝いと編集シートから共通で開く。開いただけでは設定を書き換えない
export function CheckerModal({ id, visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (!visible) {
      setToast(null);
      return;
    }
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast, visible]);
  const detail = useQuery(
    trpc.consumer.commitment.get.queryOptions({ id, today: localToday() }, { enabled: visible }),
  );
  const friends = useQuery(
    trpc.consumer.commitment.listCheckers.queryOptions({ id }, { enabled: visible && friendsOpen }),
  );
  const change = useMutation(trpc.consumer.commitment.setChecker.mutationOptions());
  const busy = sharing || change.isPending || loadingFriends;

  const openFriends = async () => {
    if (busy) return;
    setLoadingFriends(true);
    setToast(null);
    try {
      const result = await friends.refetch({ throwOnError: true });
      if (!result.data?.length) {
        setToast({ message: "友達がいません。依頼リンクを共有してみましょう。" });
        return;
      }
      setFriendsOpen(true);
    } catch {
      setToast({ message: "友達を読み込めませんでした。もう一度お試しください。" });
    } finally {
      setLoadingFriends(false);
    }
  };

  const save = async (
    selection: { mode: "self" } | { mode: "link" } | { mode: "friend"; userId: string },
    name?: string,
  ) => {
    if (busy) return;
    setError(null);
    try {
      const result = await change.mutateAsync({ id, selection });
      await queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
      if (selection.mode === "link" && result.shareToken) {
        setSharing(true);
        const url = Linking.createURL(`/invite/${result.shareToken}`);
        const message = `「${detail.data?.goal ?? "コミットメント"}」のチェックをお願いします！`;
        await Share.share(
          Platform.OS === "ios" ? { message, url } : { message: `${message}\n${url}` },
        );
      } else {
        onSaved?.(selection.mode === "self" ? "自分" : (name ?? "友達"));
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "変更できませんでした。もう一度お試しください。");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => {
        setFriendsOpen(false);
        setError(null);
      }}
      onRequestClose={() => !busy && onClose()}
    >
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <ScrollView
          style={{ backgroundColor: colors.canvas }}
          contentContainerStyle={{
            padding: 28,
            paddingTop: 32,
            paddingBottom: insets.bottom + 32,
            gap: 20,
          }}
        >
          <View className="flex-row items-center justify-between">
            {friendsOpen ? (
              <Pressable
                accessibilityLabel="依頼方法に戻る"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setFriendsOpen(false)}
                className="h-11 w-11 items-center justify-center rounded-full bg-field"
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    marginLeft: 4,
                    borderBottomWidth: 2.5,
                    borderLeftWidth: 2.5,
                    borderColor: colors.ink,
                    transform: [{ rotate: "45deg" }],
                  }}
                />
              </Pressable>
            ) : null}
            <Text
              className="text-[23px] font-bold text-ink"
              style={
                friendsOpen ? { flex: 1, textAlign: "center", marginHorizontal: 8 } : undefined
              }
            >
              {friendsOpen ? "友達から選ぶ" : "チェックを誰に頼む？"}
            </Text>
            <Pressable
              accessibilityLabel="依頼方法を閉じる"
              accessibilityRole="button"
              disabled={busy}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-field"
            >
              <Text className="text-[20px] text-ink">✕</Text>
            </Pressable>
          </View>
          {friendsOpen ? (
            <>
              <Text className="text-[15px] text-mute">
                ほかのコミットメントでチェックを依頼している友達です。
              </Text>
              {friends.isPending ? (
                <ActivityIndicator color={colors.pink} />
              ) : friends.isError ? (
                <>
                  <Text className="text-alert">友達を読み込めませんでした。</Text>
                  <SecondaryButton label="再読み込み" onPress={() => friends.refetch()} />
                </>
              ) : friends.data?.length === 0 ? (
                <Text className="py-5 text-[16px] leading-7 text-mute">
                  まだ選べる友達がいません。依頼リンクを共有して、友達に引き受けてもらいましょう。
                </Text>
              ) : (
                friends.data?.map((friend) => (
                  <Pressable
                    key={friend.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${friend.name}に依頼する`}
                    disabled={busy}
                    onPress={() => save({ mode: "friend", userId: friend.id }, friend.name)}
                    className="min-h-20 flex-row items-center gap-4 rounded-3xl bg-field px-5 py-4"
                  >
                    <Avatar
                      uri={
                        friend.image?.startsWith("/")
                          ? `${ENV.EXPO_PUBLIC_SERVER_URL}${friend.image}`
                          : friend.image
                      }
                      size={42}
                      placeholderColor={colors.line}
                    />
                    <Text className="flex-1 text-[18px] font-semibold text-ink">{friend.name}</Text>
                    <Text className="text-[14px] text-mute">選ぶ</Text>
                  </Pressable>
                ))
              )}
            </>
          ) : (
            <>
              <Text className="text-[16px] text-mute">
                今のチェック者：{detail.data?.checkerUser?.name ?? "自分"}
              </Text>
              <SecondaryButton
                label="自分で判定する"
                disabled={busy}
                onPress={() => save({ mode: "self" })}
              />
              <Text className="pt-3 text-[17px] font-semibold text-ink">友達に依頼する</Text>
              <PrimaryButton
                label={sharing ? "共有中…" : "依頼リンクを共有"}
                disabled={busy || !detail.data}
                onPress={() => save({ mode: "link" })}
              />
              <SecondaryButton
                label={loadingFriends ? "読み込み中…" : "友達から選ぶ"}
                disabled={busy}
                onPress={openFriends}
              />
              <Text className="text-[14px] leading-6 text-mute">
                依頼リンクは ichiro
                アプリで開きます。友達が引き受けるまでは、今のチェック者のままです。
              </Text>
              {detail.data?.shareToken ? (
                <Text className="text-[14px] text-mute">
                  依頼リンクを発行済みです。同じリンクをもう一度共有できます。
                </Text>
              ) : null}
              {detail.isError ? (
                <Text className="text-alert">
                  設定を読み込めませんでした。閉じてもう一度お試しください。
                </Text>
              ) : null}
            </>
          )}
          {busy ? <ActivityIndicator color={colors.pink} /> : null}
          {error ? (
            <Text accessibilityRole="alert" className="text-[14px] text-alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>
        {toast ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 24, right: 24, bottom: insets.bottom + 20 }}
          >
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{ backgroundColor: colors.ink, borderRadius: 18, padding: 18 }}
            >
              <Text style={{ color: "white", fontSize: 15, lineHeight: 23 }}>{toast.message}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

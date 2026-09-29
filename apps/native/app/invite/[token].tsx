import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton, ScreenHeader } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { colors } from "@/lib/theme";
import { trpc } from "@/utils/trpc";

export default function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invite = useQuery(
    trpc.consumer.commitment.getInvitation.queryOptions(
      { token },
      { enabled: !!session && !accepted, retry: false },
    ),
  );
  const accept = useMutation(trpc.consumer.commitment.acceptInvitation.mutationOptions());
  const leave = () => router.replace(session ? "/" : "/welcome");
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 30 }}
    >
      <ScreenHeader title="チェックの依頼" onBack={leave} />
      <View className="gap-6 px-[30px] pt-10">
        {!session ? (
          <>
            <Text className="text-[20px] font-bold text-ink">
              友達からチェックの依頼が届いています
            </Text>
            <Text className="text-[16px] leading-7 text-mute">
              ログインして内容を確認し、引き受けるか選べます。
            </Text>
            <PrimaryButton
              label="ログインして確認する"
              onPress={async () => {
                try {
                  await SecureStore.setItemAsync("pending-checker-invitation", token);
                  router.push("/sign-in");
                } catch {
                  setError("依頼を保存できませんでした。もう一度お試しください。");
                }
              }}
            />
          </>
        ) : accepted ? (
          <>
            <Text className="text-[24px] font-bold text-ink">チェックを引き受けました</Text>
            <Text className="text-[16px] text-mute">
              依頼した友達のチェック者に設定されました。
            </Text>
            <PrimaryButton label="ホームへ" onPress={leave} />
          </>
        ) : invite.isPending ? (
          <ActivityIndicator color={colors.pink} />
        ) : invite.isError ? (
          <>
            <Text className="text-[20px] font-bold text-ink">依頼を確認できません</Text>
            <Text className="text-[16px] text-mute">{invite.error.message}</Text>
            <PrimaryButton label="もう一度確認する" onPress={() => invite.refetch()} />
          </>
        ) : invite.data ? (
          <>
            <Text className="text-[16px] text-mute">{invite.data.ownerName}さんからの依頼</Text>
            <Text className="text-[26px] font-bold text-ink">{invite.data.goal}</Text>
            <Text className="text-[18px] leading-8 text-ink">{invite.data.content}</Text>
            <Text className="text-[16px] text-mute">期間：{invite.data.untilDate}まで</Text>
            {invite.data.isOwn ? (
              <Text className="text-[16px] text-mute">
                これは自分の依頼です。リンクを友達に送ってください。
              </Text>
            ) : (
              <PrimaryButton
                label={accept.isPending ? "設定中…" : "チェックを引き受ける"}
                disabled={accept.isPending}
                onPress={() => {
                  setError(null);
                  accept.mutate(
                    { token },
                    {
                      onSuccess: () => {
                        setAccepted(true);
                        queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
                      },
                      onError: (e) => setError(e.message),
                    },
                  );
                }}
              />
            )}
          </>
        ) : null}
        {error ? <Text className="text-alert">{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

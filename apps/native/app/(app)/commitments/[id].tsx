import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CommitmentForm,
  type FormValues,
  toApiValues,
  validate,
} from "@/components/commitment-form";
import { PenaltyHistory } from "@/components/penalty-history";
import { PrimaryButton, ScreenHeader } from "@/components/ui";
import { useReport } from "@/lib/commitments";
import { formatMonthDay, localTimeZone, localToday, toDateString } from "@/lib/date";
import { colors } from "@/lib/theme";
import { trpc } from "@/utils/trpc";

const WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

type Detail = {
  streak: number;
  dueToday: boolean;
  reportedToday: boolean;
  week: { date: string; reported: boolean }[];
  onReport: () => void;
};

// 連続達成と今週の記録、今日の報告ボタン
function StreakCard({ streak, dueToday, reportedToday, week, onReport }: Detail) {
  return (
    <View className="mx-4 mb-1 mt-3.5 gap-[18px] rounded-[36px] border border-card-line bg-card px-6 py-[22px]">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text className="text-[13px] text-mute">連続達成</Text>
          <Text className="text-[30px] font-extrabold text-pink">{streak}日</Text>
        </View>
        <View className="flex-row gap-1.5">
          {week.map((d, i) => (
            <View key={d.date} className="items-center gap-1.5">
              <View
                className="h-[26px] w-[26px] rounded-full"
                style={{ backgroundColor: d.reported ? colors.pink : colors.dot }}
              />
              <Text className="text-[11px] text-faint">{WEEK_LABELS[i]}</Text>
            </View>
          ))}
        </View>
      </View>
      {reportedToday ? (
        <View className="h-14 items-center justify-center rounded-[28px] bg-pink-soft">
          <Text className="text-[17px] font-bold text-pink">今日は報告ずみ　えらいワン</Text>
        </View>
      ) : dueToday ? (
        <PrimaryButton label="今日の達成を報告する" height={56} fontSize={17} onPress={onReport} />
      ) : null}
    </View>
  );
}

type Invitation = {
  kind: "registered" | "sign_up";
  status: "sent" | "failed";
  createdAt: string | Date;
};

// 友達に送った招待メールの状況と、再送ボタン
function InvitationStatus({
  invitation,
  resending,
  onResend,
}: {
  invitation: Invitation;
  resending: boolean;
  onResend: () => void;
}) {
  const failed = invitation.status === "failed";
  return (
    <View className="mx-[30px] mt-3 min-h-[62px] flex-row items-center gap-3 rounded-[31px] bg-field py-2 pl-[26px] pr-2">
      <View className="flex-1 gap-0.5">
        <Text className="text-[12px] text-mute">
          {invitation.kind === "registered" ? "チェックのお願い" : "会員登録のお願い"}
        </Text>
        <Text
          className="text-[15px] font-semibold"
          style={{ color: failed ? colors.pinkDeep : colors.ink }}
        >
          {failed
            ? "送れませんでした"
            : `${formatMonthDay(toDateString(new Date(invitation.createdAt)))} に送信ずみ`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={resending}
        onPress={onResend}
        className="h-[46px] items-center justify-center rounded-[23px] bg-white px-4 active:bg-pink-soft"
        style={{ opacity: resending ? 0.6 : 1 }}
      >
        <Text className="text-[15px] font-bold text-ink">{resending ? "…" : "再送する"}</Text>
      </Pressable>
    </View>
  );
}

export default function CommitmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const report = useReport();
  const today = localToday();
  const { data } = useQuery(trpc.consumer.commitment.get.queryOptions({ id, today }));
  const update = useMutation(trpc.consumer.commitment.update.mutationOptions());
  const resend = useMutation(trpc.consumer.commitment.resendInvitation.mutationOptions());
  const [values, setValues] = useState<FormValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 最初に読み込んだ内容をフォームの初期値にする。再取得で入力中の内容は上書きしない
  useEffect(() => {
    if (!data || values) return;
    setValues({
      goal: data.goal,
      content: data.content,
      frequency: data.frequency,
      weekdays: data.weekdays,
      monthDays: data.monthDays,
      untilDate: data.untilDate,
      penalty: data.penaltyAmount !== null,
      amount: data.penaltyAmount ?? 500,
      paymentMethodId: data.paymentMethodId,
      checker: data.checker,
      friendEmail: data.friendEmail ?? "",
    });
  }, [data, values]);

  const submit = () => {
    if (!values) return;
    const invalid = validate(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    update.mutate(
      { id, timeZone: localTimeZone(), values: toApiValues(values) },
      {
        onError: (e) => setError(e.message),
        onSuccess: (c) => {
          queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
          router.back();
          if (c.invitation?.status === "failed") {
            Alert.alert(
              "招待メールを送れませんでした",
              "変更は保存されています。詳細ページから再送できます。",
            );
          }
        },
      },
    );
  };

  const resendInvitation = () => {
    resend.mutate(
      { id },
      {
        onError: (e) => Alert.alert("再送できませんでした", e.message),
        onSuccess: (inv) => {
          queryClient.invalidateQueries(trpc.consumer.commitment.get.queryFilter({ id, today }));
          if (inv.status === "failed") {
            Alert.alert("招待メールを送れませんでした", "時間をおいてもう一度お試しください。");
          }
        },
      },
    );
  };

  // 保存ずみの友達のメールアドレスのままのときだけ、送信状況を出す
  const invitation =
    data?.invitation &&
    values?.checker === "friend" &&
    values.friendEmail.trim().toLowerCase() === data.invitation.email
      ? data.invitation
      : null;

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 60 }}
    >
      <ScreenHeader title="コミットメント詳細" onBack={() => router.back()} />
      {data && values ? (
        <CommitmentForm
          values={values}
          onChange={setValues}
          showSuggestions={false}
          minimumDate={data.startDate}
          header={
            <>
              <StreakCard {...data} onReport={() => report(data)} />
              <PenaltyHistory {...data} />
            </>
          }
          editing
          friendFooter={
            invitation ? (
              <InvitationStatus
                invitation={invitation}
                resending={resend.isPending}
                onResend={resendInvitation}
              />
            ) : null
          }
          cta="変更を保存"
          submitting={update.isPending}
          error={error}
          onSubmit={submit}
        />
      ) : (
        <ActivityIndicator color={colors.pink} className="pt-10" />
      )}
    </KeyboardAwareScrollView>
  );
}

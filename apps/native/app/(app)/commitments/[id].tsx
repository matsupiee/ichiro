import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CommitmentForm,
  type FormValues,
  toApiValues,
  validate,
} from "@/components/commitment-form";
import { PenaltyHistory } from "@/components/penalty-history";
import { FieldLabel, PrimaryButton, RowButton, ScreenHeader } from "@/components/ui";
import { useReport } from "@/lib/commitments";
import { localTimeZone, localToday } from "@/lib/date";
import { colors } from "@/lib/theme";
import { CheckerModal } from "@/components/checker-modal";
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

export default function CommitmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const report = useReport();
  const today = localToday();
  const { data } = useQuery(trpc.consumer.commitment.get.queryOptions({ id, today }));
  const update = useMutation(trpc.consumer.commitment.update.mutationOptions());
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
        onSuccess: () => {
          queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
          router.back();
        },
      },
    );
  };

  const [checkerOpen, setCheckerOpen] = useState(false);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="コミットメント詳細" onBack={() => router.back()} />
      <KeyboardAwareScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      >
        {data && values ? (
          <CommitmentForm
            values={values}
            onChange={setValues}
            minimumDate={data.startDate}
            header={
              <>
                <StreakCard {...data} onReport={() => report(data)} />
                <PenaltyHistory {...data} />
              </>
            }
            editing
            checkerField={
              <>
                <FieldLabel>チェック者</FieldLabel>
                <RowButton onPress={() => setCheckerOpen(true)}>
                  <View className="flex-1 py-3">
                    <Text className="text-[17px] font-semibold text-ink">
                      {data.checkerUser?.name ?? "自分"}
                    </Text>
                    {data.shareToken ? (
                      <Text className="text-[13px] text-mute">依頼リンクを発行済み</Text>
                    ) : null}
                  </View>
                  <Text className="mr-3 text-[14px] text-mute">変更</Text>
                </RowButton>
                <CheckerModal id={id} visible={checkerOpen} onClose={() => setCheckerOpen(false)} />
              </>
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
    </View>
  );
}

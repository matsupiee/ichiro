import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCelebrate } from "@/components/celebration/celebration";
import {
  CommitmentForm,
  type FormValues,
  toApiValues,
  validate,
} from "@/components/commitment-form";
import { ScreenHeader } from "@/components/ui";
import { addDays, formatMonthDay, formatYen, localTimeZone, localToday } from "@/lib/date";
import { trpc } from "@/utils/trpc";

function blank(today: string): FormValues {
  return {
    content: "",
    frequency: "daily",
    weekdays: [1, 3, 5],
    monthDays: [1],
    untilDate: addDays(today, 90),
    penalty: false,
    amount: 500,
    paymentMethodId: null,
  };
}

export default function NewCommitmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const celebrate = useCelebrate();
  const queryClient = useQueryClient();
  const today = localToday();
  const [values, setValues] = useState(() => blank(today));
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(trpc.consumer.commitment.create.mutationOptions());

  const submit = () => {
    const invalid = validate(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    create.mutate(
      { today, timeZone: localTimeZone(), values: toApiValues(values) },
      {
        onError: (e) => setError(e.message),
        onSuccess: (c) => {
          queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
          router.back();
          celebrate({
            title: "宣言したワン！",
            closeLabel: "ホームに戻る",
            message: `「${c.content}」スタート。いっしょにがんばろう`,
            tiles:
              c.penaltyAmount !== null
                ? [
                    { label: "期間", value: `〜${formatMonthDay(c.untilDate)}` },
                    { label: "罰金", value: formatYen(c.penaltyAmount) },
                  ]
                : [{ label: "期間", value: `〜${formatMonthDay(c.untilDate)}` }],
          });
        },
      },
    );
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 60 }}
    >
      <ScreenHeader title="コミットメント作成" onBack={() => router.back()} />
      <CommitmentForm
        values={values}
        onChange={setValues}
        minimumDate={today}
        cta="宣言する"
        submitting={create.isPending}
        error={error}
        onSubmit={submit}
      />
    </KeyboardAwareScrollView>
  );
}

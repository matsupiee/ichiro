import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useCelebrate } from "../../../../components/celebration/celebration";
import {
  CommitmentForm,
  type FormValues,
  toApiValues,
  validate,
} from "../../../../components/commitment-form";
import { Screen, ScreenHeader } from "../../../../components/ui";
import {
  addDays,
  formatMonthDay,
  formatYen,
  localTimeZone,
  localToday,
} from "../../../../lib/date";
import { useTRPC } from "../../../../lib/trpc";

export const Route = createFileRoute("/app/_member/commitments/new")({
  head: () => ({ meta: [{ title: "コミットメント作成 | ichiro" }] }),
  component: NewCommitmentScreen,
});

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

function NewCommitmentScreen() {
  const navigate = useNavigate();
  const celebrate = useCelebrate();
  const trpc = useTRPC();
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
          void queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
          void navigate({ to: "/app", replace: true });
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
    <Screen>
      <ScreenHeader title="コミットメント作成" onBack={() => void navigate({ to: "/app" })} />
      <CommitmentForm
        values={values}
        onChange={setValues}
        minimumDate={today}
        cta="宣言する"
        submitting={create.isPending}
        error={error}
        onSubmit={submit}
      />
    </Screen>
  );
}

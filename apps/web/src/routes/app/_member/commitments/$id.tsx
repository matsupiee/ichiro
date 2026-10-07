import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  CommitmentForm,
  type FormValues,
  toApiValues,
  validate,
} from "../../../../components/commitment-form";
import { PenaltyHistory } from "../../../../components/penalty-history";
import { PrimaryButton, Screen, ScreenHeader, Spinner } from "../../../../components/ui";
import { useReport } from "../../../../lib/commitments";
import { localTimeZone, localToday } from "../../../../lib/date";
import { useTRPC } from "../../../../lib/trpc";

export const Route = createFileRoute("/app/_member/commitments/$id")({
  head: () => ({ meta: [{ title: "コミットメント詳細 | ichiro" }] }),
  component: CommitmentDetailScreen,
});

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
    <section
      aria-label="連続達成"
      className="mx-4 mt-3.5 mb-1 flex flex-col gap-[18px] rounded-[36px] border border-card-line bg-card px-6 py-[22px]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-mute">連続達成</span>
          <span className="text-[30px] font-extrabold text-brand-ink">{streak}日</span>
        </div>
        <ol aria-label="今週の記録" className="flex gap-1.5">
          {week.map((d, i) => (
            <li key={d.date} className="flex flex-col items-center gap-1.5">
              <span
                aria-label={`${WEEK_LABELS[i]}曜日 ${d.reported ? "報告ずみ" : "未報告"}`}
                className={`size-[26px] rounded-full ${d.reported ? "bg-brand" : "bg-[#CEDFE9]"}`}
              />
              <span aria-hidden className="text-[11px] text-faint">
                {WEEK_LABELS[i]}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {reportedToday ? (
        <p className="flex h-14 items-center justify-center rounded-[28px] bg-brand-soft text-[17px] font-bold text-brand-ink">
          今日は報告ずみ　えらいワン
        </p>
      ) : dueToday ? (
        <PrimaryButton label="今日の達成を報告する" onClick={onReport} />
      ) : null}
    </section>
  );
}

function CommitmentDetailScreen() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const report = useReport();
  const today = localToday();
  const {
    data,
    isError,
    error: loadError,
  } = useQuery(trpc.consumer.commitment.get.queryOptions({ id, today }));
  const update = useMutation(trpc.consumer.commitment.update.mutationOptions());
  const [values, setValues] = useState<FormValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 最初に読み込んだ内容をフォームの初期値にする。再取得で入力中の内容は上書きしない
  useEffect(() => {
    if (!data || values) return;
    setValues({
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
          void queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter());
          void navigate({ to: "/app" });
        },
      },
    );
  };

  return (
    <Screen>
      <div className="sticky top-0 z-10 bg-canvas pb-3">
        <ScreenHeader title="コミットメント詳細" onBack={() => void navigate({ to: "/app" })} />
      </div>
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
          cta="変更を保存"
          submitting={update.isPending}
          error={error}
          onSubmit={submit}
        />
      ) : isError ? (
        <p role="alert" className="px-[30px] pt-10 text-center text-[15px] text-mute">
          {loadError.message}
        </p>
      ) : (
        <Spinner className="pt-10" />
      )}
    </Screen>
  );
}

import { type FormEvent, type ReactNode, useId } from "react";

import { formatYen } from "../lib/date";
import { PaymentMethodPicker } from "./payment-method-picker";
import { ErrorText, NoteText, PrimaryButton } from "./ui";

export type Frequency = "daily" | "weekly" | "monthly" | "once";

export type FormValues = {
  content: string;
  frequency: Frequency;
  weekdays: number[];
  monthDays: number[];
  untilDate: string;
  penalty: boolean;
  amount: number;
  // consumer.payment.listMethods の ID。罰金ありのときに使う
  paymentMethodId: string | null;
};

export const MIN_PENALTY = 100;
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const FREQUENCIES: [Frequency, string][] = [
  ["daily", "毎日"],
  ["weekly", "曜日ごと"],
  ["monthly", "月の特定の日"],
  ["once", "1回だけ"],
];
const QUICK_AMOUNTS = [500, 1000, 3000];

export function toApiValues(v: FormValues) {
  return {
    content: v.content,
    frequency: v.frequency,
    weekdays: v.weekdays,
    monthDays: v.monthDays,
    untilDate: v.untilDate,
    penaltyAmount: v.penalty ? v.amount : null,
    paymentMethodId: v.penalty ? v.paymentMethodId : null,
  };
}

// サーバーと同じ条件を先に確かめて、すぐに分かるエラーは送信前に出す
export function validate(v: FormValues): string | null {
  if (!v.content.trim()) return "コミット内容を入力してください";
  if (v.frequency === "weekly" && v.weekdays.length === 0) return "曜日を選んでください";
  if (v.frequency === "monthly" && v.monthDays.length === 0) return "日付を選んでください";
  if (v.penalty && v.amount < MIN_PENALTY) return `罰金は${MIN_PENALTY}円以上にしてください`;
  if (v.penalty && !v.paymentMethodId) return "支払い方法を選んでください";
  return null;
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  const className = "block px-[54px] pt-[22px] pb-2.5 text-[17px] text-ink";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <p className={className}>{children}</p>
  );
}

const chip = (selected: boolean) =>
  selected ? "bg-ink text-white" : "bg-[#EAF3F8] text-ink hover:bg-card-pressed";

type Props = {
  values: FormValues;
  onChange: (v: FormValues) => void;
  // 詳細ページで既存のコミットメントを変更しているとき
  editing?: boolean;
  minimumDate: string;
  header?: ReactNode;
  cta: string;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
};

// コミットメント作成ページと詳細ページで共通のフォーム
export function CommitmentForm({
  values: v,
  onChange,
  editing = false,
  minimumDate,
  header,
  cta,
  submitting,
  error,
  onSubmit,
}: Props) {
  const id = useId();
  const set = <K extends keyof FormValues>(k: K, value: FormValues[K]) =>
    onChange({ ...v, [k]: value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form noValidate onSubmit={submit}>
      {header}

      <Label htmlFor={`${id}-content`}>コミット内容</Label>
      <div className="mx-[30px] rounded-[31px] bg-field px-[26px] focus-within:ring-2 focus-within:ring-brand">
        <textarea
          id={`${id}-content`}
          value={v.content}
          onChange={(event) => set("content", event.target.value)}
          // Enter では改行せず入力を閉じる。登録はボタンで行う
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder="毎日30分広東語を練習する"
          autoComplete="off"
          className="block h-36 w-full resize-none bg-transparent py-[18px] text-[17px] leading-6 text-ink caret-brand outline-none placeholder:text-faint"
        />
      </div>

      <Label>結果報告の頻度</Label>
      <div className="mx-[30px] flex flex-col gap-3.5 rounded-[32px] bg-field p-3.5">
        <div role="radiogroup" aria-label="結果報告の頻度" className="grid grid-cols-2 gap-2.5">
          {FREQUENCIES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={v.frequency === k}
              onClick={() => set("frequency", k)}
              className={`h-12 rounded-2xl text-[16px] font-semibold transition-colors ${chip(v.frequency === k)}`}
            >
              {label}
            </button>
          ))}
        </div>
        {v.frequency === "weekly" ? (
          <div className="flex justify-between px-0.5">
            {DOW.map((label, i) => {
              const selected = v.weekdays.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${label}曜日`}
                  onClick={() => set("weekdays", toggle(v.weekdays, i))}
                  className={`size-[38px] rounded-full text-[15px] font-bold ${selected ? "bg-brand text-white" : "bg-[#EAF3F8] text-ink"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
        {v.frequency === "monthly" ? (
          <div className="grid grid-cols-7 gap-y-1.5">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
              const selected = v.monthDays.includes(d);
              return (
                <div key={d} className="flex justify-center">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${d}日`}
                    onClick={() => set("monthDays", toggle(v.monthDays, d))}
                    className={`size-9 rounded-full text-[14px] font-semibold ${selected ? "bg-brand text-white" : "text-ink hover:bg-[#EAF3F8]"}`}
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <Label htmlFor={`${id}-until`}>
        {v.frequency === "once" ? "実施日" : "いつまで続ける？"}
      </Label>
      <div className="mx-[30px] flex min-h-[62px] items-center rounded-[31px] bg-field px-[26px] focus-within:ring-2 focus-within:ring-brand">
        <input
          id={`${id}-until`}
          type="date"
          required
          value={v.untilDate}
          min={minimumDate}
          onChange={(event) => {
            // 開始日（作成時は今日）より前の日付は選べない
            const value = event.target.value;
            if (value && value >= minimumDate) set("untilDate", value);
          }}
          className="w-full bg-transparent py-[18px] text-[17px] text-ink outline-none"
        />
      </div>

      <label className="mx-[30px] mt-[30px] flex min-h-[66px] cursor-pointer items-center justify-between rounded-[33px] bg-field pr-5 pl-[26px] text-[17px] text-ink">
        罰金を設定する
        <input
          type="checkbox"
          role="switch"
          checked={v.penalty}
          onChange={(event) => set("penalty", event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-[34px] w-[60px] rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ink after:absolute after:top-[3px] after:left-[3px] after:size-7 after:rounded-full after:bg-white after:shadow-[0_2px_6px_rgba(0,0,0,0.18)] after:transition-[left] after:duration-200 peer-checked:after:left-[29px]"
        />
      </label>
      {v.penalty ? (
        <>
          <div className="mx-[30px] mt-3 flex flex-col gap-3.5 rounded-[32px] bg-field py-[18px] pr-[18px] pl-[26px]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="100円減らす"
                onClick={() => set("amount", Math.max(MIN_PENALTY, v.amount - 100))}
                className="flex size-11 items-center justify-center rounded-full bg-white text-[24px] font-semibold text-ink"
              >
                −
              </button>
              <output aria-label="罰金の金額" className="text-[30px] font-extrabold text-ink">
                {formatYen(v.amount)}
              </output>
              <button
                type="button"
                aria-label="100円増やす"
                onClick={() => set("amount", v.amount + 100)}
                className="flex size-11 items-center justify-center rounded-full bg-white text-[24px] font-semibold text-ink"
              >
                ＋
              </button>
            </div>
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={v.amount === a}
                  onClick={() => set("amount", a)}
                  className={`h-10 flex-1 rounded-[14px] text-[15px] font-semibold transition-colors ${chip(v.amount === a)}`}
                >
                  {formatYen(a)}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-3">
            <NoteText>
              結果報告日の23:59:59までに完了できなかったら、この金額が徴収されます。最低100円。
              {editing ? "変更した金額と支払い方法は、今日の報告分から使われます。" : ""}
            </NoteText>
          </div>

          <Label>支払い方法</Label>
          <PaymentMethodPicker
            value={v.paymentMethodId}
            onChange={(paymentMethodId) => set("paymentMethodId", paymentMethodId)}
          />
        </>
      ) : null}

      <ErrorText message={error} />
      <div className="px-[30px] pt-9">
        <PrimaryButton type="submit" label={submitting ? "…" : cta} disabled={submitting} />
      </div>
    </form>
  );
}

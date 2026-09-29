import type { CommitmentFrequency } from "@ichiro/db/schema/commitment";

export type CommitmentValues = {
  goal: string;
  content: string;
  frequency: CommitmentFrequency;
  weekdays: number[];
  monthDays: number[];
  untilDate: string;
  penaltyAmount: number | null;
  paymentMethodId: string | null;
};

const MIN_PENALTY = 100;
const MAX_PENALTY = 1_000_000;

// 作成と変更で同じ判定にそろえる、設定の組み合わせの検証。見つかった問題をすべて返す
export function validateCommitmentValues(v: CommitmentValues) {
  const issues: { path: keyof CommitmentValues; message: string }[] = [];
  if (v.frequency === "weekly" && v.weekdays.length === 0) {
    issues.push({ path: "weekdays", message: "曜日を選んでください" });
  }
  if (v.frequency === "monthly" && v.monthDays.length === 0) {
    issues.push({ path: "monthDays", message: "日付を選んでください" });
  }
  if (v.penaltyAmount !== null && v.penaltyAmount < MIN_PENALTY) {
    issues.push({ path: "penaltyAmount", message: `罰金は${MIN_PENALTY}円以上にしてください` });
  }
  if (v.penaltyAmount !== null && v.penaltyAmount > MAX_PENALTY) {
    issues.push({
      path: "penaltyAmount",
      message: `罰金は${MAX_PENALTY.toLocaleString("ja-JP")}円以下にしてください`,
    });
  }
  if (v.penaltyAmount !== null && v.paymentMethodId === null) {
    issues.push({ path: "paymentMethodId", message: "支払い方法を選んでください" });
  }
  return issues;
}

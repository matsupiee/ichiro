import type { CommitmentValues } from "./validate-commitment-values";

// DB に入れる形にそろえる。罰金なしなら支払い方法を持たない
export function normalizeCommitmentValues(v: CommitmentValues) {
  return {
    ...v,
    weekdays: [...new Set(v.weekdays)].sort(),
    monthDays: [...new Set(v.monthDays)].sort((a, b) => a - b),
    paymentMethodId: v.penaltyAmount !== null ? v.paymentMethodId : null,
  };
}

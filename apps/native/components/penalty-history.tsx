import { Text, View } from "react-native";

import { formatMonthDay, formatYen } from "@/lib/date";

type Status = "pending" | "processing" | "paid" | "failed";

type Props = {
  penaltyAmount: number | null;
  penaltyTotal: number;
  penalties: {
    id: string;
    dueDate: string;
    amount: number;
    status: Status;
    failureMessage: string | null;
  }[];
};

const STATUS_LABELS: Record<Status, string> = {
  paid: "徴収ずみ",
  pending: "徴収待ち",
  processing: "処理中",
  failed: "徴収できませんでした",
};

// 詳細ページの「罰金の記録」。報告できなかった日と、その罰金の徴収状況
export function PenaltyHistory({ penaltyAmount, penaltyTotal, penalties }: Props) {
  // 罰金を設定したことがなければ出さない
  if (penaltyAmount === null && penalties.length === 0) return null;

  return (
    <View className="mx-4 mt-3 gap-3.5 rounded-[36px] border border-card-line bg-card px-6 py-[22px]">
      <View className="flex-row items-end justify-between">
        <View className="gap-0.5">
          <Text className="text-[13px] text-mute">これまでの罰金</Text>
          <Text className="text-[30px] font-extrabold text-ink">{formatYen(penaltyTotal)}</Text>
        </View>
        <Text className="pb-1.5 text-[13px] text-faint">{penalties.length}回</Text>
      </View>
      {penalties.length === 0 ? (
        <Text className="text-[14px] leading-[22px] text-mute">
          まだ罰金はないワン。この調子でつづけよう。
        </Text>
      ) : (
        <View className="gap-2">
          {penalties.map((p) => (
            <View
              key={p.id}
              className="min-h-[48px] flex-row items-center gap-3 rounded-[24px] bg-white px-[18px]"
            >
              <Text className="w-[52px] text-[15px] font-semibold text-ink">
                {formatMonthDay(p.dueDate)}
              </Text>
              <View className="flex-1 gap-0.5 py-2.5">
                <Text
                  className={`text-[13px] ${p.status === "failed" ? "text-alert" : "text-mute"}`}
                >
                  {STATUS_LABELS[p.status]}
                </Text>
                {p.status === "failed" && p.failureMessage ? (
                  <Text className="text-[12px] leading-[17px] text-faint">{p.failureMessage}</Text>
                ) : null}
              </View>
              <Text className="text-[16px] font-bold text-ink">{formatYen(p.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

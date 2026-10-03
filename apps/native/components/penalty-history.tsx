import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { Chevron, ScreenHeader } from "@/components/ui";

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

// 詳細ページには導線だけを置き、罰金の記録はシートで開く。
export function PenaltyHistory({ penaltyAmount, penaltyTotal, penalties }: Props) {
  const [visible, setVisible] = useState(false);

  // 罰金を設定したことがなければ出さない
  if (penaltyAmount === null && penalties.length === 0) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="これまでの罰金"
        accessibilityHint="合計金額と徴収履歴を開きます"
        onPress={() => setVisible(true)}
        className="mx-4 mt-1 min-h-12 flex-row items-center justify-between rounded-2xl px-6 active:bg-field"
      >
        <Text className="text-[14px] text-mute">これまでの罰金</Text>
        <Chevron />
      </Pressable>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-canvas">
            <ScreenHeader title="これまでの罰金" onBack={() => setVisible(false)} />
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
              <View className="mx-4 mt-5 gap-3.5 rounded-[36px] border border-card-line bg-card px-6 py-[22px]">
                <View className="flex-row items-end justify-between">
                  <View className="gap-0.5">
                    <Text className="text-[13px] text-mute">合計</Text>
                    <Text className="text-[30px] font-extrabold text-ink">
                      {formatYen(penaltyTotal)}
                    </Text>
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
                            <Text className="text-[12px] leading-[17px] text-faint">
                              {p.failureMessage}
                            </Text>
                          ) : null}
                        </View>
                        <Text className="text-[16px] font-bold text-ink">
                          {formatYen(p.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

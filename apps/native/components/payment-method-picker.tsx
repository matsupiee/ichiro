import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { NoteText } from "@/components/ui";
import { paymentMethodLabel, useAddPaymentMethod } from "@/lib/payments";
import { colors } from "@/lib/theme";
import { trpc } from "@/utils/trpc";

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#fff",
        borderWidth: selected ? 7 : 2,
        borderColor: selected ? colors.brand : colors.line,
      }}
    />
  );
}

type Props = {
  value: string | null;
  onChange: (id: string) => void;
};

// 罰金を引き落とす支払い方法を、Stripe に登録ずみのものから選ぶ。その場で追加もできる
export function PaymentMethodPicker({ value, onChange }: Props) {
  const { data: methods, isPending } = useQuery(trpc.consumer.payment.listMethods.queryOptions());
  const { add, adding } = useAddPaymentMethod();

  // まだ選んでいなければ、最初に登録した支払い方法を選んでおく
  const first = methods?.[0]?.id;
  useEffect(() => {
    if (value === null && first) onChange(first);
  }, [value, first, onChange]);

  if (isPending) return <ActivityIndicator color={colors.brand} className="py-4" />;

  return (
    <>
      <View className="mx-[30px] gap-2.5">
        {methods?.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            className="min-h-[62px] flex-row items-center justify-between rounded-[31px] bg-field pl-[26px] pr-[22px]"
          >
            <Text className="flex-1 text-[17px] text-ink" numberOfLines={1}>
              {paymentMethodLabel(m)}
            </Text>
            <Radio selected={value === m.id} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          disabled={adding}
          onPress={async () => {
            const added = await add();
            if (added) onChange(added.id);
          }}
          className="min-h-[62px] flex-row items-center justify-center rounded-[31px] border border-dashed border-line active:bg-field"
        >
          {adding ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text className="text-[16px] font-semibold text-ink-2">＋ 支払い方法を追加</Text>
          )}
        </Pressable>
      </View>
      {methods?.length === 0 ? (
        <NoteText>
          カードか Apple Pay を登録してください。登録は Stripe で安全に行われます。
        </NoteText>
      ) : null}
    </>
  );
}

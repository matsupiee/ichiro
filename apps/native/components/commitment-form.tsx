import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { type ReactNode, useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BrandGradient } from "@/components/brand-gradient";
import { PaymentMethodPicker } from "@/components/payment-method-picker";
import { ErrorText, Field, FieldLabel, NoteText, PrimaryButton } from "@/components/ui";
import { formatFullDate, formatYen, fromDateString, toDateString } from "@/lib/date";
import { colors, shadows } from "@/lib/theme";

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

function chip(selected: boolean) {
  return {
    backgroundColor: selected ? colors.ink : colors.chipOff,
    color: selected ? "#fff" : colors.ink,
  };
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Choice({
  label,
  style,
  onPress,
}: {
  label: string | number;
  style: {
    backgroundColor: string;
    color: string;
    size: number;
    radius: number;
    font: number;
    weight: "600" | "700";
  };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: style.size,
        height: style.size,
        borderRadius: style.radius,
        backgroundColor: style.backgroundColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {style.backgroundColor === colors.pink ? <BrandGradient radius={style.radius} /> : null}
      <Text style={{ color: style.color, fontSize: style.font, fontWeight: style.weight }}>
        {label}
      </Text>
    </Pressable>
  );
}

function DateField({
  value,
  minimumDate,
  onChange,
}: {
  value: string;
  minimumDate: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === "web") {
    return <Field value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" />;
  }

  const press = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: fromDateString(value),
        minimumDate: fromDateString(minimumDate),
        mode: "date",
        onChange: (e, d) => {
          if (e.type === "set" && d) onChange(toDateString(d));
        },
      });
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <>
      <Pressable
        onPress={press}
        className="mx-[30px] min-h-[62px] flex-row items-center rounded-[31px] bg-field px-[26px]"
      >
        <Text className="text-[17px] text-ink">{formatFullDate(value)}</Text>
      </Pressable>
      {open ? (
        <View className="mx-[30px] mt-2.5 items-center rounded-[31px] bg-white">
          <DateTimePicker
            value={fromDateString(value)}
            minimumDate={fromDateString(minimumDate)}
            mode="date"
            display="inline"
            locale="ja-JP"
            accentColor={colors.pink}
            onChange={(_, d) => d && onChange(toDateString(d))}
          />
        </View>
      ) : null}
    </>
  );
}

function PenaltySwitch({ on }: { on: boolean }) {
  const x = useSharedValue(on ? 29 : 3);
  useEffect(() => {
    x.value = withTiming(on ? 29 : 3, { duration: 200 });
  }, [on, x]);
  const knob = useAnimatedStyle(() => ({ left: x.value }));
  return (
    <View
      style={{
        width: 60,
        height: 34,
        borderRadius: 17,
        backgroundColor: on ? colors.toggleOn : colors.line,
      }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 3,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#fff",
            boxShadow: shadows.knob,
          },
          knob,
        ]}
      />
    </View>
  );
}

type Props = {
  values: FormValues;
  onChange: (v: FormValues) => void;
  // 詳細ページで既存のコミットメントを変更しているとき
  editing?: boolean;
  minimumDate: string;
  header?: ReactNode;
  // 編集シートだけに表示するチェック者の欄
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
  const set = <K extends keyof FormValues>(k: K, value: FormValues[K]) =>
    onChange({ ...v, [k]: value });

  return (
    <>
      {header}

      <FieldLabel>コミット内容</FieldLabel>
      <Field
        value={v.content}
        onChangeText={(t) => set("content", t)}
        placeholder="毎日30分広東語を練習する"
        accessibilityLabel="コミット内容"
        multiline
        submitBehavior="newline"
        textAlignVertical="top"
        style={{ height: 144, lineHeight: 24 }}
      />

      <FieldLabel>結果報告の頻度</FieldLabel>
      <View className="mx-[30px] gap-3.5 rounded-[32px] bg-field p-3.5">
        <View className="flex-row flex-wrap gap-2.5">
          {FREQUENCIES.map(([k, label]) => {
            const c = chip(v.frequency === k);
            return (
              <Pressable
                key={k}
                onPress={() => set("frequency", k)}
                className="h-12 items-center justify-center rounded-2xl"
                style={{ width: "48%", flexGrow: 1, backgroundColor: c.backgroundColor }}
              >
                <Text style={{ color: c.color, fontSize: 16, fontWeight: "600" }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {v.frequency === "weekly" ? (
          <View className="flex-row justify-between px-0.5">
            {DOW.map((label, i) => {
              const sel = v.weekdays.includes(i);
              return (
                <Choice
                  key={label}
                  label={label}
                  onPress={() => set("weekdays", toggle(v.weekdays, i))}
                  style={{
                    size: 38,
                    radius: 19,
                    font: 15,
                    weight: "700",
                    backgroundColor: sel ? colors.pink : colors.chipOff,
                    color: sel ? "#fff" : colors.ink,
                  }}
                />
              );
            })}
          </View>
        ) : null}
        {v.frequency === "monthly" ? (
          <View className="flex-row flex-wrap" style={{ rowGap: 6 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
              const sel = v.monthDays.includes(d);
              return (
                <View key={d} style={{ width: `${100 / 7}%`, alignItems: "center" }}>
                  <Choice
                    label={d}
                    onPress={() => set("monthDays", toggle(v.monthDays, d))}
                    style={{
                      size: 36,
                      radius: 18,
                      font: 14,
                      weight: "600",
                      backgroundColor: sel ? colors.pink : "transparent",
                      color: sel ? "#fff" : colors.ink,
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <FieldLabel>{v.frequency === "once" ? "実施日" : "いつまで続ける？"}</FieldLabel>
      <DateField
        value={v.untilDate}
        minimumDate={minimumDate}
        onChange={(d) => set("untilDate", d)}
      />

      <Pressable
        onPress={() => set("penalty", !v.penalty)}
        className="mx-[30px] mt-[30px] min-h-[66px] flex-row items-center justify-between rounded-[33px] bg-field pl-[26px] pr-5"
      >
        <Text className="text-[17px] text-ink">罰金を設定する</Text>
        <PenaltySwitch on={v.penalty} />
      </Pressable>
      {v.penalty ? (
        <>
          <View className="mx-[30px] mt-3 gap-3.5 rounded-[32px] bg-field py-[18px] pl-[26px] pr-[18px]">
            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityLabel="100円減らす"
                onPress={() => set("amount", Math.max(MIN_PENALTY, v.amount - 100))}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
              >
                <Text className="text-[24px] font-semibold text-ink">−</Text>
              </Pressable>
              <Text className="text-[30px] font-extrabold text-ink">{formatYen(v.amount)}</Text>
              <Pressable
                accessibilityLabel="100円増やす"
                onPress={() => set("amount", v.amount + 100)}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
              >
                <Text className="text-[24px] font-semibold text-ink">＋</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              {QUICK_AMOUNTS.map((a) => {
                const c = chip(v.amount === a);
                return (
                  <Pressable
                    key={a}
                    onPress={() => set("amount", a)}
                    className="h-10 flex-1 items-center justify-center rounded-[14px]"
                    style={{ backgroundColor: c.backgroundColor }}
                  >
                    <Text style={{ color: c.color, fontSize: 15, fontWeight: "600" }}>
                      {formatYen(a)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <NoteText>
            結果報告日の23:59:59までに完了できなかったら、この金額が徴収されます。最低100円。
            {editing ? "変更した金額と支払い方法は、今日の報告分から使われます。" : ""}
          </NoteText>

          <FieldLabel>支払い方法</FieldLabel>
          <PaymentMethodPicker
            value={v.paymentMethodId}
            onChange={(id) => set("paymentMethodId", id)}
          />
        </>
      ) : null}

      <ErrorText message={error} />
      <View className="px-[30px] pt-9">
        <PrimaryButton label={submitting ? "…" : cta} disabled={submitting} onPress={onSubmit} />
      </View>
    </>
  );
}

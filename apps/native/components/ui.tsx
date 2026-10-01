import { forwardRef, type ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { colors } from "@/lib/theme";

// setlog 風の大きな角丸パーツ。寸法はデザイン（393pt 幅）の値そのまま。

type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  height?: number;
  fontSize?: number;
};

// 水色のフラットなボタン。押している間は色で反応を示す
export function PrimaryButton({
  label,
  height = 60,
  fontSize = 18,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => ({
        height,
        borderRadius: height / 2,
        backgroundColor: pressed ? colors.brandPressed : colors.brand,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
      })}
      {...props}
    >
      <Text style={{ fontSize, fontWeight: "700", color: colors.white }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, height = 60, fontSize = 18, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className="items-center justify-center bg-field active:bg-field-pressed"
      style={{ height, borderRadius: height / 2 }}
      {...props}
    >
      <Text className="font-bold text-ink" style={{ fontSize }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="戻る"
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full bg-white active:bg-field"
    >
      <View
        style={{
          width: 10,
          height: 10,
          marginLeft: 4,
          borderBottomWidth: 2.5,
          borderLeftWidth: 2.5,
          borderColor: colors.ink,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </Pressable>
  );
}

// 戻る・タイトル・右の空きの3つを並べたヘッダー
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-6 pt-3.5">
      <BackButton onPress={onBack} />
      <Text className="text-[21px] font-bold text-ink">{title}</Text>
      <View className="w-12" />
    </View>
  );
}

export function Chevron({ color = colors.ink }: { color?: string }) {
  return (
    <View
      style={{
        width: 9,
        height: 9,
        marginRight: 4,
        borderTopWidth: 2.5,
        borderRightWidth: 2.5,
        borderColor: color,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

// 回転させた L 字で描くチェックマーク
export function CheckMark({
  width,
  height,
  thickness,
  color,
  offsetY,
}: {
  width: number;
  height: number;
  thickness: number;
  color: string;
  offsetY: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        marginTop: offsetY,
        borderRightWidth: thickness,
        borderBottomWidth: thickness,
        borderColor: color,
        borderRadius: 1,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text className="px-[54px] pb-2.5 pt-[22px] text-[17px] text-ink">{children}</Text>;
}

type FieldProps = TextInputProps & { bold?: boolean };

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { bold, style, ...props },
  ref,
) {
  return (
    <View className="mx-[30px] min-h-[62px] flex-row items-center rounded-[31px] bg-field px-[26px]">
      <TextInput
        ref={ref}
        placeholderTextColor={colors.faint}
        selectionColor={colors.brand}
        style={[
          { flex: 1, minWidth: 0, fontSize: 17, color: colors.ink, paddingVertical: 18 },
          bold && { fontWeight: "700" },
          style,
        ]}
        {...props}
      />
    </View>
  );
});

// 灰色の大きな角丸の行。右に矢印
export function RowButton({
  children,
  onPress,
  showChevron = true,
  minHeight = 64,
}: {
  children: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  minHeight?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-[30px] flex-row items-center justify-between rounded-[36px] bg-field pl-[26px] pr-[22px] active:bg-field-pressed"
      style={{ minHeight }}
    >
      {children}
      {showChevron ? <Chevron /> : null}
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text className="px-11 pt-3 text-center text-[14px] leading-[22px] text-alert">{message}</Text>
  );
}

export function NoteText({ children }: { children: ReactNode }) {
  return (
    <Text className="px-11 pt-3 text-center text-[14px] leading-[22px] text-mute">{children}</Text>
  );
}

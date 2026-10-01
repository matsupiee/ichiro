import { Alert, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { CheckMark } from "@/components/ui";
import { formatPeriod } from "@/lib/date";
import { colors } from "@/lib/theme";

type Props = {
  content: string;
  startDate: string;
  untilDate: string;
  dueToday: boolean;
  reportedToday: boolean;
  onOpen: () => void;
  onReport: () => void;
};

const reportDots = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2 - Math.PI / 2;
  return { x: 18 + Math.cos(angle) * 16, y: 18 + Math.sin(angle) * 16 };
});

// メインページのコミットメントの行。期間、コミット内容の順に表示する
export function CommitmentCard(props: Props) {
  return (
    <Pressable
      onPress={props.onOpen}
      className="flex-row items-center gap-3.5 rounded-[36px] border border-card-line bg-card py-5 pl-6 pr-4 active:bg-card-pressed"
    >
      <View className="min-w-0 flex-1 gap-1.5">
        <Text numberOfLines={1} className="text-[13px] font-semibold text-faint">
          {formatPeriod(props.startDate, props.untilDate)}
        </Text>
        <Text numberOfLines={3} className="text-[21px] font-extrabold text-ink">
          {props.content}
        </Text>
      </View>
      {props.reportedToday ? (
        <View accessibilityLabel="今日の報告済み" className="h-11 w-11 items-center justify-center">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
            <CheckMark width={8} height={14} thickness={3} color="#fff" offsetY={-3} />
          </View>
        </View>
      ) : props.dueToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="今日の達成を報告する"
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            Alert.alert(
              "達成済みにしますか？？",
              `「${props.content}」の今日の達成を報告します。`,
              [
                { text: "キャンセル", style: "cancel" },
                { text: "達成済みにする", isPreferred: true, onPress: props.onReport },
              ],
            );
          }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: pressed ? colors.brandSoft : "transparent",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Svg width={36} height={36} viewBox="0 0 36 36" accessible={false}>
            {reportDots.map((dot, index) => (
              <Circle key={index} cx={dot.x} cy={dot.y} r={1.75} fill={colors.brand} />
            ))}
          </Svg>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

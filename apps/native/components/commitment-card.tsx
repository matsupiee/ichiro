import { Alert, Pressable, Text, View } from "react-native";

import { CheckMark, Chevron } from "@/components/ui";
import { formatPeriod } from "@/lib/date";
import { colors, shadows } from "@/lib/theme";

type Props = {
  goal: string;
  content: string;
  startDate: string;
  untilDate: string;
  dueToday: boolean;
  reportedToday: boolean;
  onOpen: () => void;
  onReport: () => void;
};

// メインページのコミットメントの行。期間、目標、コミット内容の順に表示する
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
        <Text numberOfLines={1} className="text-[21px] font-extrabold text-ink">
          {props.goal}
        </Text>
        <Text numberOfLines={1} className="text-[14px] text-mute">
          {props.content}
        </Text>
      </View>
      {props.reportedToday ? (
        <View className="h-[44px] w-[44px] items-center justify-center rounded-full bg-pink-soft">
          <CheckMark width={9} height={17} thickness={4} color={colors.pink} offsetY={-4} />
        </View>
      ) : props.dueToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="今日の達成を報告する"
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            Alert.alert("達成済みにしますか？？", `「${props.goal}」の今日の達成を報告します。`, [
              { text: "キャンセル", style: "cancel" },
              { text: "達成済みにする", onPress: props.onReport },
            ]);
          }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.pink,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: pressed ? shadows.pinkRoundPressed : shadows.pinkRound,
            transform: [{ translateY: pressed ? 3 : 0 }],
          })}
        >
          <CheckMark width={9} height={17} thickness={4} color="#fff" offsetY={-4} />
        </Pressable>
      ) : null}
      <View style={{ marginLeft: -2, marginRight: 2 }}>
        <Chevron />
      </View>
    </Pressable>
  );
}

import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { Avatar } from "@/components/avatar";
import { CommitmentCard } from "@/components/commitment-card";
import { Dog } from "@/components/dog/dog";
import { ProfileSheet } from "@/components/profile-sheet";
import { CheckMark } from "@/components/ui";
import { useAvatar } from "@/lib/avatar";
import { useReport } from "@/lib/commitments";
import { localToday } from "@/lib/date";
import { colors, fonts, shadows } from "@/lib/theme";
import { trpc } from "@/utils/trpc";

export default function MainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheetModal>(null);
  const avatar = useAvatar();
  const report = useReport();
  const today = localToday();
  const { data: items, isPending } = useQuery(
    trpc.consumer.commitment.list.queryOptions({ today }),
  );

  const remaining = (items ?? []).filter((c) => c.dueToday && !c.reportedToday).length;

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 + insets.bottom }}
      >
        <View className="flex-row items-center justify-between pl-[30px] pr-6 pt-[22px]">
          <Text
            style={{
              fontFamily: fonts.logo,
              fontSize: 38,
              lineHeight: 44,
              color: colors.pink,
              letterSpacing: -0.5,
            }}
          >
            ichiro
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="アカウント"
            onPress={() => sheet.current?.present()}
            className="h-[58px] w-[58px] items-center justify-center rounded-full bg-white"
            style={{ boxShadow: shadows.avatarButton }}
          >
            <Avatar
              uri={avatar.uri}
              size={42}
              placeholderColor={colors.field}
              loading={avatar.busy}
              placeholder={
                <Svg width={26} height={26} viewBox="0 0 24 24" accessible={false}>
                  <Circle cx={12} cy={8} r={4} fill={colors.mute} />
                  <Path d="M4 21v-1a8 8 0 0 1 16 0v1Z" fill={colors.mute} />
                </Svg>
              }
            />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2.5 px-[30px] pb-[22px] pt-[18px]">
          <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-pink">
            <CheckMark width={5} height={9} thickness={2.5} color="#fff" offsetY={-2} />
          </View>
          <Text numberOfLines={1} className="flex-1 text-[17px] text-mute">
            {remaining > 0
              ? `今日の報告 あと${remaining}件`
              : items?.some((c) => c.dueToday)
                ? "今日はぜんぶ報告ずみ"
                : "今日の報告はありません"}
          </Text>
        </View>

        {isPending ? (
          <ActivityIndicator color={colors.pink} className="pt-10" />
        ) : items && items.length > 0 ? (
          <View className="gap-3 px-4">
            {items.map((c) => (
              <CommitmentCard
                key={c.id}
                {...c}
                onOpen={() => router.push(`/commitments/${c.id}`)}
                onReport={() => report(c)}
              />
            ))}
          </View>
        ) : (
          <View className="items-center gap-3 px-[30px] pt-10">
            <Dog size={140} />
            <Text className="text-center text-[16px] leading-[27px] text-mute">
              {"まだ目標がないワン。\n右下の＋から宣言しよう。"}
            </Text>
          </View>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="コミットメントを作成"
        onPress={() => router.push("/commitments/new")}
        className="absolute h-[68px] w-[68px] items-center justify-center rounded-full bg-white active:scale-95"
        style={{ right: 26, bottom: insets.bottom + 6, boxShadow: shadows.fab }}
      >
        <View style={{ width: 26, height: 26 }}>
          <View
            style={{
              position: "absolute",
              left: 11.5,
              top: 0,
              width: 3,
              height: 26,
              borderRadius: 2,
              backgroundColor: colors.ink,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 11.5,
              left: 0,
              width: 26,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.ink,
            }}
          />
        </View>
      </Pressable>

      <ProfileSheet ref={sheet} avatar={avatar} />
    </View>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { useCelebrate } from "@/components/celebration/celebration";
import { localToday } from "@/lib/date";
import { trpc } from "@/utils/trpc";

type Reportable = { id: string; goal: string; streak: number };

// 今日の達成を報告する。待たせないように先にお祝いを出し、裏でサーバーに送る
export function useReport() {
  const celebrate = useCelebrate();
  const queryClient = useQueryClient();
  const mutation = useMutation(trpc.commitment.report.mutationOptions());

  return (c: Reportable) => {
    const today = localToday();
    celebrate({
      message: `「${c.goal}」今日も達成！`,
      tiles: [{ label: "連続達成", value: `${c.streak + 1}日` }],
    });
    queryClient.setQueryData(trpc.commitment.list.queryKey({ today }), (list) =>
      list?.map((x) => (x.id === c.id ? { ...x, reportedToday: true, streak: x.streak + 1 } : x)),
    );
    mutation.mutate(
      { id: c.id, today },
      {
        onError: (e) => Alert.alert("報告できませんでした", e.message),
        onSettled: () => queryClient.invalidateQueries(trpc.commitment.pathFilter()),
      },
    );
  };
}

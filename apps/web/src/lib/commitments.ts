import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useCelebrate } from "../components/celebration/celebration";
import { useDialog } from "../components/dialog";
import { chooseAchievementAnimation } from "./achievement-animation";
import { localToday } from "./date";
import { useTRPC } from "./trpc";

type Reportable = { id: string; content: string; streak: number };

// 今日の達成を報告する。待たせないように先にお祝いを出し、裏でサーバーに送る
export function useReport() {
  const celebrate = useCelebrate();
  const dialog = useDialog();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const mutation = useMutation(trpc.consumer.commitment.report.mutationOptions());

  return (c: Reportable) => {
    const today = localToday();
    celebrate({
      illustration: chooseAchievementAnimation(),
      message: `「${c.content}」今日も達成！`,
      tiles: [{ label: "連続達成", value: `${c.streak + 1}日` }],
    });
    queryClient.setQueryData(trpc.consumer.commitment.list.queryKey({ today }), (list) =>
      list?.map((x) => (x.id === c.id ? { ...x, reportedToday: true, streak: x.streak + 1 } : x)),
    );
    mutation.mutate(
      { id: c.id, today },
      {
        onError: (e) => void dialog.alert({ title: "報告できませんでした", message: e.message }),
        onSettled: () => queryClient.invalidateQueries(trpc.consumer.commitment.pathFilter()),
      },
    );
  };
}

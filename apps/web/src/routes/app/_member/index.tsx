import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Avatar, PersonIcon } from "../../../components/avatar";
import { CommitmentCard } from "../../../components/commitment-card";
import { Dog } from "../../../components/dog/dog";
import { BrandLogo, CheckMark, Screen, Spinner } from "../../../components/ui";
import { useReport } from "../../../lib/commitments";
import { localToday } from "../../../lib/date";
import { useTRPC } from "../../../lib/trpc";

export const Route = createFileRoute("/app/_member/")({
  component: HomeScreen,
});

// メインページ。コミットメントの一覧と今日の報告
function HomeScreen() {
  const { user } = Route.useRouteContext();
  const trpc = useTRPC();
  const report = useReport();
  const today = localToday();
  const { data: items, isPending } = useQuery(
    trpc.consumer.commitment.list.queryOptions({ today }),
  );

  const remaining = (items ?? []).filter((c) => c.dueToday && !c.reportedToday).length;

  return (
    <Screen>
      <header className="flex items-center justify-between pt-[22px] pr-6 pl-[30px]">
        <BrandLogo width={150} />
        <Link
          to="/app/account"
          aria-label="アカウント"
          className="flex size-[58px] items-center justify-center rounded-full bg-white transition-colors hover:bg-field"
        >
          <Avatar
            src={user.image}
            size={42}
            placeholderClassName="bg-field"
            placeholder={<PersonIcon />}
          />
        </Link>
      </header>

      <div className="flex items-center gap-2.5 px-[30px] pt-[18px] pb-[22px]">
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand">
          <CheckMark width={5} height={9} thickness={2.5} offsetY={-2} />
        </span>
        <p className="truncate text-[17px] text-mute">
          {isPending
            ? " "
            : remaining > 0
              ? `今日の報告 あと${remaining}件`
              : items?.some((c) => c.dueToday)
                ? "今日はぜんぶ報告ずみ"
                : "今日の報告はありません"}
        </p>
      </div>

      {isPending ? (
        <Spinner className="pt-10" />
      ) : items && items.length > 0 ? (
        <ul className="flex flex-col gap-3 px-4 pb-[120px]">
          {items.map((c) => (
            <li key={c.id}>
              <CommitmentCard {...c} onReport={() => report(c)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 px-[30px] pt-10">
          <Dog size={140} />
          <p className="text-center text-[16px] leading-[27px] whitespace-pre-line text-mute">
            {"まだ目標がないワン。\n右下の＋から宣言しよう。"}
          </p>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 mx-auto flex max-w-[440px] justify-end px-[26px] pb-[max(18px,env(safe-area-inset-bottom))]">
        <Link
          to="/app/commitments/new"
          aria-label="コミットメントを作成"
          className="pointer-events-auto flex size-[68px] items-center justify-center rounded-full bg-white transition-colors hover:bg-field"
        >
          <span aria-hidden className="relative block size-[26px]">
            <span className="absolute top-0 left-[11.5px] h-[26px] w-[3px] rounded-sm bg-ink" />
            <span className="absolute top-[11.5px] left-0 h-[3px] w-[26px] rounded-sm bg-ink" />
          </span>
        </Link>
      </div>
    </Screen>
  );
}

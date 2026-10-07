import { Link } from "@tanstack/react-router";

import { useDialog } from "./dialog";
import { CheckMark } from "./ui";
import { formatPeriod } from "../lib/date";

type Props = {
  id: string;
  content: string;
  startDate: string;
  untilDate: string;
  dueToday: boolean;
  reportedToday: boolean;
  onReport: () => void;
};

const reportDots = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2 - Math.PI / 2;
  return { x: 18 + Math.cos(angle) * 16, y: 18 + Math.sin(angle) * 16 };
});

// メインページのコミットメントの行。期間、コミット内容の順に表示する
export function CommitmentCard(props: Props) {
  const dialog = useDialog();
  return (
    <div className="relative flex items-center gap-3.5 rounded-[36px] border border-card-line bg-card py-5 pr-4 pl-6 transition-colors has-[a:hover]:bg-card-pressed">
      <Link
        to="/app/commitments/$id"
        params={{ id: props.id }}
        className="flex min-w-0 flex-1 flex-col gap-1.5 after:absolute after:inset-0 after:rounded-[36px] after:content-['']"
      >
        <span className="truncate text-[13px] font-semibold text-faint">
          {formatPeriod(props.startDate, props.untilDate)}
        </span>
        <span className="line-clamp-3 text-[21px] font-extrabold break-words text-ink">
          {props.content}
        </span>
      </Link>
      {props.reportedToday ? (
        <span
          role="img"
          aria-label="今日の報告済み"
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-brand">
            <CheckMark width={8} height={14} thickness={3} offsetY={-3} />
          </span>
        </span>
      ) : props.dueToday ? (
        <button
          type="button"
          aria-label="今日の達成を報告する"
          onClick={async () => {
            const ok = await dialog.confirm({
              title: "達成済みにしますか？？",
              message: `「${props.content}」の今日の達成を報告します。`,
              confirmLabel: "達成済みにする",
            });
            if (ok) props.onReport();
          }}
          className="relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-brand-soft active:bg-brand-soft"
        >
          <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden>
            {reportDots.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r={1.75} fill="#3DC4F4" />
            ))}
          </svg>
        </button>
      ) : null}
    </div>
  );
}

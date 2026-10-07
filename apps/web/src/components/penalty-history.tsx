import { useEffect, useRef, useState } from "react";

import { formatMonthDay, formatYen } from "../lib/date";
import { Chevron, ScreenHeader } from "./ui";

type Status = "pending" | "processing" | "paid" | "failed";

type Props = {
  penaltyAmount: number | null;
  penaltyTotal: number;
  penalties: {
    id: string;
    dueDate: string;
    amount: number;
    status: Status;
    failureMessage: string | null;
  }[];
};

const STATUS_LABELS: Record<Status, string> = {
  paid: "徴収ずみ",
  pending: "徴収待ち",
  processing: "処理中",
  failed: "徴収できませんでした",
};

function HistorySheet({ onClose, ...props }: Props & { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const { penaltyTotal, penalties } = props;
  return (
    <dialog
      ref={ref}
      aria-label="これまでの罰金"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // シートの外側を押したら閉じる
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-auto mt-auto mb-0 h-[min(92dvh,760px)] max-h-none w-full max-w-[440px] rounded-t-[36px] bg-canvas p-0 text-ink backdrop:bg-black/20"
    >
      <div className="h-full overflow-y-auto pb-8">
        <ScreenHeader title="これまでの罰金" onBack={onClose} />
        <div className="mx-4 mt-5 flex flex-col gap-3.5 rounded-[36px] border border-card-line bg-card px-6 py-[22px]">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-mute">合計</span>
              <span className="text-[30px] font-extrabold">{formatYen(penaltyTotal)}</span>
            </div>
            <span className="pb-1.5 text-[13px] text-faint">{penalties.length}回</span>
          </div>
          {penalties.length === 0 ? (
            <p className="text-[14px] leading-[22px] text-mute">
              まだ罰金はないワン。この調子でつづけよう。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {penalties.map((p) => (
                <li
                  key={p.id}
                  className="flex min-h-12 items-center gap-3 rounded-[24px] bg-white px-[18px]"
                >
                  <span className="w-[52px] text-[15px] font-semibold">
                    {formatMonthDay(p.dueDate)}
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5 py-2.5">
                    <span
                      className={`text-[13px] ${p.status === "failed" ? "text-alert" : "text-mute"}`}
                    >
                      {STATUS_LABELS[p.status]}
                    </span>
                    {p.status === "failed" && p.failureMessage ? (
                      <span className="text-[12px] leading-[17px] text-faint">
                        {p.failureMessage}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[16px] font-bold">{formatYen(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}

// 詳細ページには導線だけを置き、罰金の記録はシートで開く
export function PenaltyHistory(props: Props) {
  const [open, setOpen] = useState(false);

  // 罰金を設定したことがなければ出さない
  if (props.penaltyAmount === null && props.penalties.length === 0) return null;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="mx-4 mt-1 flex min-h-12 w-[calc(100%-32px)] items-center justify-between rounded-2xl px-6 text-[14px] text-mute transition-colors hover:bg-field"
      >
        これまでの罰金
        <Chevron />
      </button>
      {open ? <HistorySheet {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

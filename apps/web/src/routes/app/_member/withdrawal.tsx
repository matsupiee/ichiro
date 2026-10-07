import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { ErrorText, Screen, ScreenHeader } from "../../../components/ui";
import { authClient } from "../../../lib/auth-client";
import { useTRPC } from "../../../lib/trpc";

export const Route = createFileRoute("/app/_member/withdrawal")({
  head: () => ({ meta: [{ title: "ichiro の退会 | ichiro" }] }),
  component: WithdrawalScreen,
});

const notices = [
  "退会は取り消せません。",
  "退会後は、このアカウントでログインできなくなります。",
  "退会すると、新しい罰金の請求と未払い分の再請求が停止します。",
  "退会前に開始した決済は、退会後に完了する場合があります。",
  "すでに決済済みの罰金は、退会による返金の対象にはなりません。",
];

function WithdrawalScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const mutation = useMutation(trpc.consumer.account.withdraw.mutationOptions());
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);

  const submit = async () => {
    if (!acknowledged || working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await mutation.mutateAsync({ acknowledged: true });
      // サーバーで全セッションは失効済み。ブラウザの Cookie も消す
      await authClient.signOut().catch(() => undefined);
      queryClient.clear();
      setDone(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "通信環境を確認して、もう一度お試しください",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <div
          role="status"
          className="flex flex-1 flex-col items-center justify-center gap-4 px-[30px] text-center"
        >
          <p className="text-[22px] font-bold text-ink">退会しました</p>
          <p className="text-[16px] text-mute">ご利用ありがとうございました。</p>
          {/* セッションは失効済み。ページを読み込み直して、未ログインの画面へ戻る */}
          <a href="/" className="pt-4 text-[15px] text-brand-ink underline">
            トップへ戻る
          </a>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="ichiro の退会"
        onBack={() => {
          if (!busy) void navigate({ to: "/app" });
        }}
      />
      <div className="px-6">
        <p className="pt-12 pb-10 text-center text-[21px] leading-8 font-semibold text-ink">
          ichiro を退会しますか？
        </p>
        <h2 className="pb-4 text-[17px] text-ink">注意事項</h2>
        <ul className="flex flex-col gap-5 rounded-[28px] bg-white px-6 py-7">
          {notices.map((notice) => (
            <li key={notice} className="flex gap-3 text-[17px] leading-7 text-ink">
              <span aria-hidden>•</span>
              <span className="flex-1">{notice}</span>
            </li>
          ))}
        </ul>
        <ErrorText message={error} />
      </div>
      <div className="mt-8 border-t border-line bg-white p-6">
        <label className="flex min-h-14 cursor-pointer items-center gap-4 pb-4 text-[17px] text-ink">
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={busy}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="size-7 accent-ink"
          />
          注意事項を確認しました
        </label>
        <button
          type="button"
          disabled={!acknowledged || busy}
          onClick={() => void submit()}
          className="flex min-h-[60px] w-full items-center justify-center rounded-full bg-danger text-[18px] font-bold text-white disabled:cursor-not-allowed disabled:bg-field disabled:text-mute"
        >
          {busy ? "処理中…" : "退会"}
        </button>
      </div>
    </Screen>
  );
}

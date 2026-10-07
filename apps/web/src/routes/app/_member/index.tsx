import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Dog } from "../../../components/dog/dog";
import { BrandLogo, ErrorText, RowButton, RowLink, Screen } from "../../../components/ui";
import { authClient } from "../../../lib/auth-client";
import { authErrorMessage } from "../../../lib/auth-error";

export const Route = createFileRoute("/app/_member/")({
  component: HomeScreen,
});

// ホーム。コミットメントの一覧は Web 版の移行（Phase 3）で作る。それまではアカウントの操作だけを置く
function HomeScreen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      queryClient.clear();
      await navigate({ to: "/app/welcome", replace: true });
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <header className="flex items-center justify-between px-6 pt-3.5">
        <BrandLogo width={120} />
      </header>
      <div className="flex flex-col items-center gap-2 px-[30px] pt-8 pb-6">
        <Dog size={120} />
        <p className="text-[18px] font-bold text-ink">{user.name} さん</p>
        <p className="text-center text-[15px] leading-6 text-mute">
          コミットメントの画面は準備中です。
        </p>
      </div>
      <section aria-label="アカウント" className="flex flex-col gap-3">
        <RowLink to="/app/change-email">
          <span className="flex min-w-0 flex-col py-3">
            <span>メールアドレス</span>
            <span className="truncate text-[14px] text-mute">{user.email}</span>
          </span>
        </RowLink>
        <RowButton disabled={busy} onClick={() => void signOut()}>
          ログアウト
        </RowButton>
        <RowLink to="/app/withdrawal">退会</RowLink>
      </section>
      <ErrorText message={error} />
    </Screen>
  );
}

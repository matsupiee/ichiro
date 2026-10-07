import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { z } from "zod";

import {
  ErrorText,
  NoteText,
  OtpField,
  PrimaryButton,
  Screen,
  ScreenHeader,
  TextButton,
} from "../../../components/ui";
import { authClient } from "../../../lib/auth-client";
import { authErrorMessage } from "../../../lib/auth-error";
import { useResendTimer } from "../../../lib/use-resend-timer";

export const Route = createFileRoute("/app/_guest/verify-email")({
  validateSearch: z.object({
    email: z.string().optional(),
    sent: z.boolean().optional(),
    deliveryFailed: z.boolean().optional(),
  }),
  beforeLoad: ({ search, context }) => {
    // 未確認のセッションがあればそのアドレス、なければ登録・ログイン画面から渡されたアドレスを確認する
    const email = context.session?.user.email ?? search.email;
    if (!email) throw redirect({ to: "/app/sign-in" });
    return { email };
  },
  head: () => ({ meta: [{ title: "メールアドレスの確認 | ichiro" }] }),
  component: VerifyEmailScreen,
});

function VerifyEmailScreen() {
  const { email } = Route.useRouteContext();
  const { sent = false, deliveryFailed = false } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(
    deliveryFailed ? authErrorMessage({ code: "EMAIL_DELIVERY_FAILED" }) : null,
  );
  const [notice, setNotice] = useState(
    sent ? "認証コードを送信しました" : "コードを送信してメールアドレスを確認してください",
  );
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const { remaining, restart } = useResendTimer(sent);

  const run = async (verify: boolean) => {
    if (working.current) return;
    if (verify && !/^\d{6}$/.test(otp)) {
      setError("6桁の認証コードを入力してください");
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = verify
        ? await authClient.emailOtp.verifyEmail({ email, otp })
        : await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      if (verify) {
        // 確認が済むとログインした状態になる（autoSignInAfterVerification）
        queryClient.clear();
        await navigate({ to: "/app", replace: true });
      } else {
        setOtp("");
        setNotice("認証コードを送信しました");
        restart();
      }
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認してください");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  // 未確認のセッションを残さずにログイン画面へ戻る
  const leave = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      queryClient.clear();
      await navigate({ to: "/app/sign-in", replace: true });
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(true);
  };

  return (
    <Screen>
      <ScreenHeader title="メールアドレスの確認" onBack={() => void leave()} />
      <div className="flex flex-col gap-3 px-[30px] pt-8 pb-5">
        <p className="text-[18px] break-all text-ink">{email}</p>
        <p className="text-[16px] leading-7 text-mute">
          {notice}。届いた6桁のコードを入力してください。有効期限は5分です。
        </p>
      </div>
      <form method="post" noValidate onSubmit={submit}>
        <OtpField value={otp} onChange={setOtp} disabled={busy} autoFocus />
        <ErrorText message={error} />
        <div className="px-[30px] pt-8">
          <PrimaryButton
            type="submit"
            label={busy ? "処理中…" : "確認してはじめる"}
            disabled={busy || otp.length !== 6}
          />
        </div>
      </form>
      <TextButton disabled={busy || remaining > 0} onClick={() => void run(false)}>
        {remaining > 0 ? `${remaining}秒後に再送できます` : "認証コードを再送する"}
      </TextButton>
      <NoteText>
        メールが届かない場合は、迷惑メールフォルダと入力したアドレスを確認してください。再送ボタンは送信から60秒後に使えます。短時間に操作を繰り返すと、一時的に制限されます。
      </NoteText>
      <TextButton disabled={busy} onClick={() => void leave()}>
        ログイン画面に戻る
      </TextButton>
    </Screen>
  );
}

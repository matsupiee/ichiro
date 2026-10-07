import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { z } from "zod";

import {
  ErrorText,
  Field,
  NoteText,
  OtpField,
  PrimaryButton,
  PrimaryLink,
  Screen,
  ScreenHeader,
  TextButton,
} from "../../../components/ui";
import { authClient } from "../../../lib/auth-client";
import { authErrorMessage } from "../../../lib/auth-error";
import { useResendTimer } from "../../../lib/use-resend-timer";

export const Route = createFileRoute("/app/_member/change-email")({
  head: () => ({ meta: [{ title: "メールアドレスを変更 | ichiro" }] }),
  component: ChangeEmailScreen,
});

// 新しいアドレスに届いたコードだけでメールアドレスを変更する
function ChangeEmailScreen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const [step, setStep] = useState<"address" | "new" | "done">("address");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const { remaining, restart } = useResendTimer();

  const send = async (resend = false) => {
    if (working.current) return;
    const email = newEmail.trim().toLowerCase();
    if (!z.email().safeParse(email).success || email === user.email.toLowerCase()) {
      setError("現在と異なる有効なメールアドレスを入力してください");
      return;
    }
    if (!resend && step !== "address" && !/^\d{6}$/.test(otp)) {
      setError("6桁の認証コードを入力してください");
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      if (step === "address" || resend) {
        const result = await authClient.emailOtp.requestEmailChange({ newEmail: email });
        if (result.error) {
          setError(authErrorMessage(result.error));
          return;
        }
        setNewEmail(email);
        setStep("new");
        restart();
      } else {
        const result = await authClient.emailOtp.changeEmail({ newEmail: email, otp });
        if (result.error) {
          setError(authErrorMessage(result.error));
          return;
        }
        // 画面に出しているメールアドレスを新しいものに取り直す
        await router.invalidate();
        setStep("done");
      }
      setOtp("");
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認してください");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <Screen>
      <ScreenHeader
        title="メールアドレスを変更"
        onBack={() => {
          if (!busy) void navigate({ to: "/app/account" });
        }}
      />
      {step === "done" ? (
        <div className="flex flex-col gap-6 px-[30px] pt-10">
          <p className="text-[22px] font-bold text-ink">メールアドレスを変更しました</p>
          <p className="text-[17px] break-all text-ink">{newEmail}</p>
          <PrimaryLink to="/app" replace label="ホームへ" />
        </div>
      ) : (
        <>
          <p className="px-[30px] pt-8 pb-4 text-[16px] leading-7 whitespace-pre-line text-mute">
            {step === "address"
              ? `現在のメールアドレス：${user.email}\n新しいメールアドレスに認証コードを送ります。`
              : `${newEmail} に送信した6桁コードを入力してください。有効期限は5分です。`}
          </p>
          <form method="post" noValidate onSubmit={submit}>
            {step === "address" ? (
              <Field
                label="新しいメールアドレス"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                disabled={busy}
              />
            ) : (
              <OtpField
                label="新しいアドレスの認証コード"
                value={otp}
                onChange={setOtp}
                disabled={busy}
                autoFocus
              />
            )}
            <ErrorText message={error} />
            <div className="px-[30px] pt-8">
              <PrimaryButton
                type="submit"
                label={
                  busy ? "処理中…" : step === "address" ? "認証コードを送る" : "確認して変更する"
                }
                disabled={busy}
              />
            </div>
          </form>
          {step !== "address" ? (
            <TextButton disabled={busy || remaining > 0} onClick={() => void send(true)}>
              {remaining > 0 ? `${remaining}秒後に再送できます` : "認証コードを再送する"}
            </TextButton>
          ) : null}
          <div className="pt-5">
            <NoteText>
              変更が完了するまでは現在のメールアドレスでログインできます。コードが届かない場合は迷惑メールフォルダも確認してください。
            </NoteText>
          </div>
        </>
      )}
    </Screen>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { z } from "zod";

import {
  ErrorText,
  Field,
  NoteText,
  OtpField,
  PasswordField,
  PrimaryButton,
  Screen,
  ScreenHeader,
  TextButton,
} from "../../../components/ui";
import { authClient } from "../../../lib/auth-client";
import { authErrorMessage } from "../../../lib/auth-error";
import { useResendTimer } from "../../../lib/use-resend-timer";

export const Route = createFileRoute("/app/_guest/reset-password")({
  // ログイン画面で入力済みのメールアドレスを引き継ぐ
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({ meta: [{ title: "パスワードの再設定 | ichiro" }] }),
  component: ResetPasswordScreen,
});

function ResetPasswordScreen() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(search.email ?? "");
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const { remaining, restart } = useResendTimer();

  const leave = () => {
    if (!working.current)
      void navigate({ to: "/app/sign-in", search: { email: email || undefined } });
  };

  const run = async (reset: boolean) => {
    if (working.current || (!reset && remaining > 0)) return;
    const parsedEmail = z.string().trim().email().safeParse(email);
    if (!parsedEmail.success) {
      setError("メールアドレスが正しくありません");
      return;
    }
    if (reset && !/^\d{6}$/.test(otp)) {
      setError("6桁の認証コードを入力してください");
      return;
    }
    if (reset && (password.length < 8 || password.length > 128)) {
      setError("パスワードは8文字以上128文字以内にしてください");
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = reset
        ? await authClient.emailOtp.resetPassword({ email: parsedEmail.data, otp, password })
        : await authClient.emailOtp.requestPasswordReset({ email: parsedEmail.data });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      setEmail(parsedEmail.data);
      setOtp("");
      if (reset) {
        setPassword("");
        setStep("done");
      } else {
        restart();
        setStep("reset");
      }
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === "done") leave();
    else void run(step === "reset");
  };

  return (
    <Screen>
      <ScreenHeader title="パスワードの再設定" onBack={leave} />
      <p className="px-[30px] pt-8 text-[16px] leading-7 text-mute">
        {step === "done"
          ? "パスワードを再設定しました。新しいパスワードでログインしてください。ほかの端末でも再ログインが必要です。"
          : step === "email"
            ? "登録したメールアドレスに、パスワードを再設定するための認証コードを送信します。"
            : "登録されているメールアドレスの場合、認証コードを送信しました。届いた最新の6桁コードと新しいパスワードを入力してください。コードの有効期限は5分です。"}
      </p>
      <form method="post" noValidate onSubmit={submit}>
        {step === "email" ? (
          <Field
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            disabled={busy}
          />
        ) : step === "reset" ? (
          <>
            <p className="px-[30px] pt-4 text-[16px] break-all text-ink">{email}</p>
            <OtpField value={otp} onChange={setOtp} disabled={busy} autoFocus />
            <PasswordField
              label="新しいパスワード"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8文字以上128文字以内"
              autoComplete="new-password"
              disabled={busy}
            />
          </>
        ) : null}
        <ErrorText message={error} />
        <div className="px-[30px] pt-8">
          <PrimaryButton
            type="submit"
            label={
              busy
                ? "処理中…"
                : step === "done"
                  ? "ログイン画面へ"
                  : step === "email"
                    ? "認証コードを送信する"
                    : "パスワードを再設定する"
            }
            disabled={busy || (step === "email" && remaining > 0)}
          />
        </div>
      </form>
      {step === "reset" ? (
        <>
          <TextButton disabled={busy || remaining > 0} onClick={() => void run(false)}>
            {remaining > 0 ? `${remaining}秒後に再送できます` : "認証コードを再送する"}
          </TextButton>
          <NoteText>
            メールが届かない場合は、迷惑メールフォルダと入力したアドレスを確認してください。
          </NoteText>
          <TextButton
            disabled={busy}
            onClick={() => {
              setStep("email");
              setOtp("");
              setPassword("");
              setError(null);
            }}
          >
            メールアドレスを変更する
          </TextButton>
        </>
      ) : step === "email" && remaining > 0 ? (
        <p className="px-[30px] pt-4 text-center text-[15px] text-mute">
          {remaining}秒後に送信できます
        </p>
      ) : null}
    </Screen>
  );
}

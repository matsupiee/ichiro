import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { authClient } from "../lib/auth-client";
import { authErrorMessage } from "../lib/auth-error";
import { Dog } from "./dog/dog";
import { ErrorText, Field, PasswordField, PrimaryButton, Screen, ScreenHeader } from "./ui";

type Mode = "sign-up" | "sign-in";

const email = z.string().trim().email("メールアドレスが正しくありません");
const password = z.string().min(8, "パスワードは8文字以上にしてください");
const schemas = {
  "sign-up": z.object({
    name: z.string().trim().min(1, "名前を入力してください"),
    email,
    password,
  }),
  "sign-in": z.object({ name: z.string(), email, password }),
};

const copy = {
  "sign-up": { title: "新規登録", cta: "登録する", swap: "アカウントをお持ちの方はこちら" },
  "sign-in": { title: "ログイン", cta: "ログイン", swap: "はじめての方はこちら" },
} as const;

const legalLink = "text-brand-ink underline";

// 新規登録とログインの共通フォーム。新規登録には名前欄と同意の案内を表示する
export function AuthForm({
  mode,
  initialEmail = "",
  initialError = null,
}: {
  mode: Mode;
  initialEmail?: string;
  initialError?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ name: "", email: initialEmail, password: "" });
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const parsed = schemas[mode].safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { name, email, password } = parsed.data;
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        if (mode === "sign-up" && result.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          await navigate({
            to: "/app/sign-in",
            search: { email, reason: "already-registered" },
            replace: true,
          });
          return;
        }
        if (
          result.error.code === "EMAIL_NOT_VERIFIED" ||
          result.error.code === "EMAIL_DELIVERY_FAILED"
        ) {
          await navigate({
            to: "/app/verify-email",
            search: {
              email,
              sent: false,
              deliveryFailed: result.error.code === "EMAIL_DELIVERY_FAILED",
            },
          });
        } else {
          setError(authErrorMessage(result.error));
        }
        return;
      }
      if (mode === "sign-up") {
        await navigate({ to: "/app/verify-email", search: { email, sent: true } });
      } else {
        queryClient.clear();
        await navigate({ to: "/app", replace: true });
      }
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください");
    } finally {
      setSubmitting(false);
    }
  };

  const c = copy[mode];

  return (
    <Screen>
      <ScreenHeader title={c.title} onBack={() => void navigate({ to: "/app/welcome" })} />
      <div className="flex justify-center pt-4">
        <Dog size={120} />
      </div>
      {/* ハイドレーション前に送信されても、入力内容が URL（履歴・ログ）に載らないよう POST にする */}
      <form method="post" noValidate onSubmit={(event) => void submit(event)}>
        {mode === "sign-up" ? (
          <Field
            label="名前"
            name="name"
            value={values.name}
            onChange={set("name")}
            placeholder="ラッシー"
            autoComplete="name"
          />
        ) : null}
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          value={values.email}
          onChange={set("email")}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
        />
        <PasswordField
          label="パスワード"
          name="password"
          value={values.password}
          onChange={set("password")}
          placeholder="8文字以上"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        />
        {mode === "sign-in" ? (
          <div className="px-[30px] pt-5 pb-1 text-center">
            <Link
              to="/app/reset-password"
              search={{ email: values.email.trim() || undefined }}
              className="text-[14px] text-brand-ink"
            >
              パスワードを忘れた方はこちら
            </Link>
          </div>
        ) : null}
        <ErrorText message={error} />
        <div className="px-[30px] pt-[34px]">
          {mode === "sign-up" ? (
            <p className="mb-5 text-[13px] leading-[22px] text-ink-2">
              「登録する」を押すと、
              <a href="/terms" target="_blank" rel="noopener" className={legalLink}>
                利用規約
              </a>
              および
              <a href="/privacy" target="_blank" rel="noopener" className={legalLink}>
                プライバシーポリシー
              </a>
              に同意したものとみなします。
            </p>
          ) : null}
          <PrimaryButton type="submit" label={submitting ? "…" : c.cta} disabled={submitting} />
        </div>
      </form>
      <Link
        to={mode === "sign-up" ? "/app/sign-in" : "/app/sign-up"}
        replace
        className="block py-[22px] text-center text-[15px] text-mute"
      >
        {c.swap}
      </Link>
    </Screen>
  );
}

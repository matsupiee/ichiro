import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, type TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import z from "zod";

import { PasswordField } from "@/components/password-field";
import { Dog } from "@/components/dog/dog";
import { ErrorText, Field, FieldLabel, PrimaryButton, ScreenHeader } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth-error";
import { authClient } from "@/lib/auth-client";
import { openLegalPage } from "@/lib/legal-pages";
import { queryClient } from "@/utils/trpc";

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

// 新規登録とログインの共通フォーム。新規登録には名前欄と同意の案内を表示する。
export function AuthForm({
  mode,
  initialEmail = "",
  initialError = null,
}: {
  mode: Mode;
  initialEmail?: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState({ name: "", email: initialEmail, password: "" });
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const set = (k: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
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
          router.replace({
            pathname: "/sign-in",
            params: { email, reason: "already-registered" },
          });
          return;
        }
        if (
          result.error.code === "EMAIL_NOT_VERIFIED" ||
          result.error.code === "EMAIL_DELIVERY_FAILED"
        ) {
          router.push({
            pathname: "/verify-email",
            params: {
              email,
              sent: "false",
              deliveryFailed: String(result.error.code === "EMAIL_DELIVERY_FAILED"),
            },
          });
        } else {
          setError(authErrorMessage(result.error));
        }
        return;
      }
      if (mode === "sign-up") {
        router.push({ pathname: "/verify-email", params: { email, sent: "true" } });
      } else {
        queryClient.clear();
      }
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください");
    } finally {
      setSubmitting(false);
    }
  };

  const c = copy[mode];

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
    >
      <ScreenHeader
        title={c.title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
      />
      <View className="items-center pt-4">
        <Dog size={120} />
      </View>
      {mode === "sign-up" ? (
        <>
          <FieldLabel>名前</FieldLabel>
          <Field
            value={values.name}
            onChangeText={set("name")}
            placeholder="ラッシー"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </>
      ) : null}
      <FieldLabel>メールアドレス</FieldLabel>
      <Field
        ref={emailRef}
        value={values.email}
        onChangeText={set("email")}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <FieldLabel>パスワード</FieldLabel>
      <PasswordField
        ref={passwordRef}
        value={values.password}
        onChangeText={set("password")}
        placeholder="8文字以上"
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        textContentType={mode === "sign-up" ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {mode === "sign-in" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/reset-password", params: { email: values.email.trim() } })
          }
          className="px-[30px] pt-5 pb-1"
        >
          <Text className="text-center text-[14px] text-brand-ink">
            パスワードを忘れた方はこちら
          </Text>
        </Pressable>
      ) : null}
      <ErrorText message={error} />
      <View className="px-[30px] pt-[34px]">
        {mode === "sign-up" ? (
          <Text className="mb-5 text-[13px] leading-[22px] text-ink-2">
            「登録する」を押すと、
            <Text
              accessibilityRole="link"
              className="text-brand-ink underline"
              onPress={() => void openLegalPage("terms")}
            >
              利用規約
            </Text>
            および
            <Text
              accessibilityRole="link"
              className="text-brand-ink underline"
              onPress={() => void openLegalPage("privacy")}
            >
              プライバシーポリシー
            </Text>
            に同意したものとみなします。
          </Text>
        ) : null}
        <PrimaryButton label={submitting ? "…" : c.cta} disabled={submitting} onPress={submit} />
      </View>
      <Pressable
        onPress={() => router.replace(mode === "sign-up" ? "/sign-in" : "/sign-up")}
        className="py-[22px]"
      >
        <Text className="text-center text-[15px] text-mute">{c.swap}</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

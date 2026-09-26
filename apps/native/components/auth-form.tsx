import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, type TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import z from "zod";

import { Dog } from "@/components/dog/dog";
import { ErrorText, Field, FieldLabel, PrimaryButton, ScreenHeader } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
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

// 新規登録とログインの画面。どちらも同じ見た目で、名前欄の有無だけが違う
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const set = (k: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    const parsed = schemas[mode].safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { name, email, password } = parsed.data;
    const handlers = {
      onError: (ctx: { error: { message?: string } }) =>
        setError(ctx.error.message || "うまくいきませんでした。もう一度お試しください"),
      onSuccess: () => {
        queryClient.clear();
      },
    };
    // 成功するとセッションが変わり、ルートのガードがメインページへ切り替える
    if (mode === "sign-up") {
      await authClient.signUp.email({ name, email, password }, handlers);
    } else {
      await authClient.signIn.email({ email, password }, handlers);
    }
    setSubmitting(false);
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
            placeholder="hiromu"
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
      <Field
        ref={passwordRef}
        value={values.password}
        onChangeText={set("password")}
        placeholder="8文字以上"
        secureTextEntry
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        textContentType={mode === "sign-up" ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText message={error} />
      <View className="px-[30px] pt-[34px]">
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

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import z from "zod";

import { PasswordField } from "@/components/password-field";
import { ErrorText, Field, FieldLabel, PrimaryButton, ScreenHeader } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(params.email ?? "");
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [nextSend, setNextSend] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((nextSend - now) / 1000));
  const leave = () => {
    if (!working.current) router.replace({ pathname: "/sign-in", params: { email } });
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
        const sentAt = Date.now();
        setNow(sentAt);
        setNextSend(sentAt + 60_000);
        setStep("reset");
      }
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
    >
      <ScreenHeader title="パスワードの再設定" onBack={leave} />
      <Text className="px-[30px] pt-8 text-[16px] leading-7 text-mute">
        {step === "done"
          ? "パスワードを再設定しました。新しいパスワードでログインしてください。ほかの端末でも再ログインが必要です。"
          : step === "email"
            ? "登録したメールアドレスに、パスワードを再設定するための認証コードを送信します。"
            : "登録されているメールアドレスの場合、認証コードを送信しました。届いた最新の6桁コードと新しいパスワードを入力してください。コードの有効期限は5分です。"}
      </Text>
      {step === "email" ? (
        <>
          <FieldLabel>メールアドレス</FieldLabel>
          <Field
            accessibilityLabel="メールアドレス"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
            returnKeyType="send"
            onSubmitEditing={() => void run(false)}
          />
        </>
      ) : step === "reset" ? (
        <>
          <Text className="px-[30px] pt-4 text-[16px] text-ink" selectable>
            {email}
          </Text>
          <FieldLabel>認証コード</FieldLabel>
          <Field
            testID="reset-code"
            accessibilityLabel="認証コード"
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="6桁のコード"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!busy}
          />
          <FieldLabel>新しいパスワード</FieldLabel>
          <PasswordField
            accessibilityLabel="新しいパスワード"
            value={password}
            onChangeText={setPassword}
            placeholder="8文字以上128文字以内"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            editable={!busy}
            onSubmitEditing={() => void run(true)}
          />
        </>
      ) : null}
      <ErrorText message={error} />
      <View className="px-[30px] pt-8">
        <PrimaryButton
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
          onPress={() => (step === "done" ? leave() : void run(step === "reset"))}
        />
      </View>
      {step === "reset" ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={busy || remaining > 0}
            onPress={() => void run(false)}
            className="px-[30px] py-6"
          >
            <Text className="text-center text-[15px] text-mute">
              {remaining > 0 ? `${remaining}秒後に再送できます` : "認証コードを再送する"}
            </Text>
          </Pressable>
          <Text className="px-[30px] text-[14px] leading-6 text-mute">
            メールが届かない場合は、迷惑メールフォルダと入力したアドレスを確認してください。
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setStep("email");
              setOtp("");
              setPassword("");
              setError(null);
            }}
            className="py-6"
          >
            <Text className="text-center text-[15px] text-mute">メールアドレスを変更する</Text>
          </Pressable>
        </>
      ) : step === "email" && remaining > 0 ? (
        <Text className="px-[30px] pt-4 text-center text-[15px] text-mute">
          {remaining}秒後に送信できます
        </Text>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

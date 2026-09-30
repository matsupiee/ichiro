import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import z from "zod";
import { ErrorText, Field, FieldLabel, PrimaryButton, ScreenHeader } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";

export default function ChangeEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [step, setStep] = useState<"address" | "new" | "done">("address");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
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
  const submit = async (resend = false) => {
    if (working.current || !session) return;
    const email = newEmail.trim().toLowerCase();
    if (!z.email().safeParse(email).success || email === session.user.email.toLowerCase()) {
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
        setNextSend(Date.now() + 60_000);
      } else if (step === "new") {
        const result = await authClient.emailOtp.changeEmail({ newEmail: email, otp });
        if (result.error) {
          setError(authErrorMessage(result.error));
          return;
        }
        await refetchSession({ query: { disableCookieCache: true } });
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
  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
    >
      <ScreenHeader
        title="メールアドレスを変更"
        onBack={() => {
          if (!busy) router.back();
        }}
      />
      {step === "done" ? (
        <View className="gap-6 px-[30px] pt-10">
          <Text className="text-[22px] font-bold text-ink">メールアドレスを変更しました</Text>
          <Text className="text-[17px] text-ink">{newEmail}</Text>
          <PrimaryButton label="ホームへ" onPress={() => router.replace("/")} />
        </View>
      ) : (
        <>
          <Text className="px-[30px] pb-4 pt-8 text-[16px] leading-7 text-mute">
            {step === "address"
              ? `現在のメールアドレス：${session?.user.email}\n新しいメールアドレスに認証コードを送ります。`
              : `${newEmail} に送信した6桁コードを入力してください。有効期限は5分です。`}
          </Text>
          {step === "address" ? (
            <>
              <FieldLabel>新しいメールアドレス</FieldLabel>
              <Field
                testID="new-email"
                accessibilityLabel="新しいメールアドレス"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                editable={!busy}
              />
            </>
          ) : (
            <>
              <FieldLabel>新しいアドレスの認証コード</FieldLabel>
              <Field
                testID="change-email-code"
                accessibilityLabel="認証コード"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6桁のコード"
                editable={!busy}
              />
            </>
          )}
          <ErrorText message={error} />
          <View className="px-[30px] pt-8">
            <PrimaryButton
              label={
                busy ? "処理中…" : step === "address" ? "認証コードを送る" : "確認して変更する"
              }
              disabled={busy}
              onPress={() => void submit()}
            />
          </View>
          {step !== "address" ? (
            <Pressable
              disabled={busy || remaining > 0}
              onPress={() => void submit(true)}
              className="px-[30px] py-6"
            >
              <Text className="text-center text-[15px] text-mute">
                {remaining > 0 ? `${remaining}秒後に再送できます` : "認証コードを再送する"}
              </Text>
            </Pressable>
          ) : null}
          <Text className="px-[30px] pt-5 text-[14px] leading-6 text-mute">
            変更が完了するまでは現在のメールアドレスでログインできます。コードが届かない場合は迷惑メールフォルダも確認してください。
          </Text>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

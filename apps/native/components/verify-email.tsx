import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorText, Field, FieldLabel, PrimaryButton, ScreenHeader } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import { queryClient } from "@/utils/trpc";

export function VerifyEmail({
  email,
  sent = false,
  deliveryFailed = false,
}: {
  email: string;
  sent?: boolean;
  deliveryFailed?: boolean;
}) {
  const router = useRouter();
  const { refetch: refetchSession } = authClient.useSession();
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(
    deliveryFailed ? authErrorMessage({ code: "EMAIL_DELIVERY_FAILED" }) : null,
  );
  const [notice, setNotice] = useState(
    sent ? "認証コードを送信しました" : "コードを送信してメールアドレスを確認してください",
  );
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [nextSend, setNextSend] = useState(sent ? Date.now() + 60_000 : 0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((nextSend - now) / 1000));
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
        queryClient.clear();
        await refetchSession({ query: { disableCookieCache: true } });
      } else {
        setOtp("");
        setNotice("認証コードを送信しました");
        setNextSend(Date.now() + 60_000);
      }
    } catch {
      setError("サーバーに接続できませんでした。通信環境を確認してください");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
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
      router.replace("/sign-in");
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
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
      <ScreenHeader title="メールアドレスの確認" onBack={leave} />
      <View className="gap-3 px-[30px] pb-5 pt-8">
        <Text className="text-[18px] text-ink" selectable>
          {email}
        </Text>
        <Text className="text-[16px] leading-7 text-mute">
          {notice}。届いた6桁のコードを入力してください。有効期限は5分です。
        </Text>
      </View>
      <FieldLabel>認証コード</FieldLabel>
      <Field
        testID="verification-code"
        accessibilityLabel="認証コード"
        value={otp}
        onChangeText={(value) => setOtp(value.replace(/[^0-9]/g, "").slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="6桁のコード"
        editable={!busy}
      />
      <ErrorText message={error} />
      <View className="px-[30px] pt-8">
        <PrimaryButton
          label={busy ? "処理中…" : "確認してはじめる"}
          disabled={busy || otp.length !== 6}
          onPress={() => void run(true)}
        />
      </View>
      <Pressable
        disabled={busy || remaining > 0}
        onPress={() => void run(false)}
        className="px-[30px] py-6"
      >
        <Text className="text-center text-[15px] text-mute">
          {remaining > 0 ? `${remaining}秒後に再送できます` : "認証コードを再送する"}
        </Text>
      </Pressable>
      <Text className="px-[30px] text-[14px] leading-6 text-mute">
        メールが届かない場合は、迷惑メールフォルダと入力したアドレスを確認してください。再送ボタンは送信から60秒後に使えます。短時間に操作を繰り返すと、一時的に制限されます。
      </Text>
      <Pressable disabled={busy} onPress={leave} className="py-6">
        <Text className="text-center text-[15px] text-mute">ログイン画面に戻る</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

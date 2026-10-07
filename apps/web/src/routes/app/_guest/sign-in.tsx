import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuthForm } from "../../../components/auth-form";
import { authErrorMessage } from "../../../lib/auth-error";

export const Route = createFileRoute("/app/_guest/sign-in")({
  // 新規登録で登録済みのアドレスを入れた場合は、メールアドレスと案内の識別子だけを引き継ぐ
  validateSearch: z.object({
    email: z.string().optional(),
    reason: z.literal("already-registered").optional(),
  }),
  head: () => ({ meta: [{ title: "ログイン | ichiro" }] }),
  component: SignInScreen,
});

function SignInScreen() {
  const { email, reason } = Route.useSearch();
  return (
    <AuthForm
      // 案内付きで開き直したときに入力欄を引き継ぎ直す
      key={`${email ?? ""}:${reason ?? ""}`}
      mode="sign-in"
      initialEmail={email}
      initialError={
        reason === "already-registered"
          ? authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })
          : null
      }
    />
  );
}

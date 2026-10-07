import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

// 未ログインで使う画面（はじめに・新規登録・ログイン・メール確認・パスワード再設定）。
// メール確認が済んだユーザーはアプリへ、未確認のユーザーはメール確認画面へ送る
export const Route = createFileRoute("/app/_guest")({
  beforeLoad: ({ context, location }) => {
    const user = context.session?.user;
    if (user?.emailVerified) throw redirect({ to: "/app" });
    if (user && location.pathname !== "/app/verify-email") {
      throw redirect({ to: "/app/verify-email", search: { email: user.email } });
    }
  },
  component: Outlet,
});

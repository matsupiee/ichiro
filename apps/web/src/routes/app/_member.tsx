import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

// ログインとメール確認が済んだユーザーだけが使う画面
export const Route = createFileRoute("/app/_member")({
  beforeLoad: ({ context }) => {
    const user = context.session?.user;
    if (!user) throw redirect({ to: "/app/welcome" });
    if (!user.emailVerified) {
      throw redirect({ to: "/app/verify-email", search: { email: user.email } });
    }
    return { user };
  },
  component: Outlet,
});

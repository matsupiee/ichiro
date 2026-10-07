import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { CelebrationProvider } from "../../components/celebration/celebration";
import { DialogProvider } from "../../components/dialog";

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
  component: MemberLayout,
});

function MemberLayout() {
  return (
    <DialogProvider>
      <CelebrationProvider>
        <Outlet />
      </CelebrationProvider>
    </DialogProvider>
  );
}

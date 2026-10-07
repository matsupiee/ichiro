import { Outlet, createFileRoute } from "@tanstack/react-router";

import { getSession } from "../../lib/session";

// /app 配下の共通の親。画面を切り替えるたびにログイン状態をサーバーで確かめる
export const Route = createFileRoute("/app")({
  beforeLoad: async () => ({ session: await getSession() }),
  component: Outlet,
});

import { createFileRoute } from "@tanstack/react-router";

import { getSession } from "../../lib/session";

// Web 版の画面は Phase 2 以降で作る。それまでの仮の入口
export const Route = createFileRoute("/app/")({
  loader: () => getSession(),
  component: AppHome,
});

function AppHome() {
  const session = Route.useLoaderData();
  return (
    <main>
      <h1>ichiro</h1>
      <p>Web 版は準備中です。</p>
      {session && <p>{session.user.email} でログインしています。</p>}
    </main>
  );
}

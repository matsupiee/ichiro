import { createFileRoute } from "@tanstack/react-router";

import { handlePublicPage } from "../server/public-page";
import { createAuth } from "../server/services";

// 未ログインなら紹介ページ、ログイン済みならアプリへ
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await (await createAuth()).api.getSession({ headers: request.headers });
        if (session) return Response.redirect(new URL("/app", request.url), 302);
        return handlePublicPage({ request });
      },
    },
  },
});

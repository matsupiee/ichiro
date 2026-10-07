import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f4fafd" },
      { name: "robots", content: "noindex" },
      { title: "ichiro" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  // ハイドレーションが済んだ印。E2E テストは入力の前にこれを待つ
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

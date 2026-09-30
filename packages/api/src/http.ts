import { Hono, type Context as HonoContext } from "hono";

import type { AuthedContext, Context } from "./context";

// tRPC の JSON に載せにくいもの（画像のバイナリなど）を素の HTTP で受けるルート。
// tRPC の publicProcedure・protectedProcedure と同じく、ルートごとに認証の要否を選ぶ

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// readSession が false のときは、ログイン状態を読まずに session を null にする
export type CreateHttpContext = (
  c: HonoContext,
  options: { readSession: boolean },
) => Promise<Context>;

export type HttpRoute = {
  method: HttpMethod;
  path: string;
  run(c: HonoContext, createContext: CreateHttpContext): Promise<Response>;
};

type HttpHandler<C> = (args: { c: HonoContext; context: C }) => Response | Promise<Response>;

// ログインなしで呼べるルート。session は読まない
export function publicHttpRoute(
  method: HttpMethod,
  path: string,
  handler: HttpHandler<Omit<Context, "session">>,
): HttpRoute {
  return {
    method,
    path,
    async run(c, createContext) {
      const { session: _, ...context } = await createContext(c, { readSession: false });
      return handler({ c, context });
    },
  };
}

// ログインが必要なルート。ログインしていなければ 401 を返す
export function protectedHttpRoute(
  method: HttpMethod,
  path: string,
  handler: HttpHandler<AuthedContext>,
): HttpRoute {
  return {
    method,
    path,
    async run(c, createContext) {
      const context = await createContext(c, { readSession: true });
      if (!context.session) return c.json({ message: "ログインしてください" }, 401);
      if (!context.session.user.emailVerified)
        return c.json({ message: "メールアドレスの確認が必要です" }, 403);
      return handler({ c, context: { ...context, session: context.session } });
    },
  };
}

export function createHttpApp(routes: HttpRoute[], createContext: CreateHttpContext) {
  const app = new Hono();
  for (const route of routes) {
    app.on(route.method, route.path, (c) => route.run(c, createContext));
  }
  return app;
}

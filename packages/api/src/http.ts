import { TRPCError } from "@trpc/server";
import { withActiveUser } from "./shared/account/with-active-user";

import type { AuthedContext, Context } from "./context";

// tRPC の JSON に載せにくいもの（画像のバイナリなど）を素の HTTP で受けるルート。
// tRPC の publicProcedure・protectedProcedure と同じく、ルートごとに認証の要否を選ぶ

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// readSession が false のときは、ログイン状態を読まずに session を null にする
export type CreateHttpContext = (
  request: Request,
  options: { readSession: boolean },
) => Promise<Context>;

// path の「:名前」の部分に当たる値
export type HttpParams = Record<string, string>;

export type HttpRoute = {
  method: HttpMethod;
  path: string;
  run(request: Request, params: HttpParams, createContext: CreateHttpContext): Promise<Response>;
};

type HttpHandler<C> = (args: {
  request: Request;
  params: HttpParams;
  context: C;
}) => Response | Promise<Response>;

// ログインなしで呼べるルート。session は読まない
export function publicHttpRoute(
  method: HttpMethod,
  path: string,
  handler: HttpHandler<Omit<Context, "session">>,
): HttpRoute {
  return {
    method,
    path,
    async run(request, params, createContext) {
      const { session: _, ...context } = await createContext(request, { readSession: false });
      return handler({ request, params, context });
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
    async run(request, params, createContext) {
      const context = await createContext(request, { readSession: true });
      if (!context.session)
        return Response.json({ message: "ログインしてください" }, { status: 401 });
      if (!context.session.user.emailVerified)
        return Response.json({ message: "メールアドレスの確認が必要です" }, { status: 403 });
      try {
        return await withActiveUser(context.db, context.session.user.id, async () =>
          handler({ request, params, context: { ...context, session: context.session! } }),
        );
      } catch (error) {
        if (error instanceof TRPCError && error.code === "UNAUTHORIZED")
          return Response.json({ message: error.message }, { status: 401 });
        throw error;
      }
    },
  };
}

// path が "/avatars/:userId/:file" のような形に当てはまれば、「:名前」の値を返す
function matchPath(pattern: string, pathname: string): HttpParams | null {
  const expected = pattern.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) return null;
  const params: HttpParams = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index]!;
    if (segment.startsWith(":")) {
      if (value === "") return null;
      params[segment.slice(1)] = decodeURIComponent(value);
    } else if (segment !== value) return null;
  }
  return params;
}

export function notFound() {
  return new Response("404 Not Found", { status: 404 });
}

// メソッドとパスからルートを選んで実行する。HEAD は GET のルートで処理し、本文を返さない
export function createHttpHandler(routes: HttpRoute[], createContext: CreateHttpContext) {
  return async (request: Request): Promise<Response> => {
    const method = request.method === "HEAD" ? "GET" : request.method;
    const { pathname } = new URL(request.url);
    for (const route of routes) {
      if (route.method !== method) continue;
      const params = matchPath(route.path, pathname);
      if (!params) continue;
      const response = await route.run(request, params, createContext);
      return request.method === "HEAD" ? new Response(null, response) : response;
    }
    return notFound();
  };
}

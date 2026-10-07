import type { AppRouter } from "@ichiro/api/routers/index";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

// 画面と API は同じオリジン。Cookie のセッションはブラウザが自動で送る
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function createTrpcClient() {
  return createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc" })] });
}

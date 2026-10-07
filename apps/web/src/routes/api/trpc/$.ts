import { appRouter } from "@ichiro/api/routers/index";
import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "../../../server/context";

function handleTrpc({ request }: { request: Request }) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: ({ req }) => createContext(req),
  });
}

export const Route = createFileRoute("/api/trpc/$")({
  server: { handlers: { GET: handleTrpc, POST: handleTrpc } },
});

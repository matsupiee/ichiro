import { createFileRoute } from "@tanstack/react-router";

import { createAuth } from "../../../server/services";

// https://www.better-auth.com/docs/integrations/tanstack
async function handleAuth({ request }: { request: Request }) {
  return (await createAuth()).handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handleAuth, POST: handleAuth } },
});

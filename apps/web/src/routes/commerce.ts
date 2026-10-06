import { createFileRoute } from "@tanstack/react-router";

import { handlePublicPage } from "../server/public-page";

export const Route = createFileRoute("/commerce")({
  server: { handlers: { GET: handlePublicPage } },
});

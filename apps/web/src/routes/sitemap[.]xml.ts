import { createFileRoute } from "@tanstack/react-router";

import { handleSitemap } from "../server/public-page";

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: handleSitemap } },
});

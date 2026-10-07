import { createFileRoute } from "@tanstack/react-router";

import { handleRobots } from "../server/public-page";

export const Route = createFileRoute("/robots.txt")({
  server: { handlers: { GET: handleRobots } },
});

import { createFileRoute } from "@tanstack/react-router";

import { handleHttpRoute } from "../../server/http-app";

// 処理は packages/api の profileGetAvatarRoute
export const Route = createFileRoute("/avatars/$")({
  server: { handlers: { GET: handleHttpRoute } },
});

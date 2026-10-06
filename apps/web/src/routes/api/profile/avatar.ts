import { createFileRoute } from "@tanstack/react-router";

import { handleHttpRoute } from "../../../server/http-app";

// 処理は packages/api の profileUploadAvatarRoute・profileDeleteAvatarRoute
export const Route = createFileRoute("/api/profile/avatar")({
  server: { handlers: { PUT: handleHttpRoute, DELETE: handleHttpRoute } },
});

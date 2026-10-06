import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { createAuth } from "../server/services";

// ログイン中のセッション。未ログインなら null
// https://www.better-auth.com/docs/integrations/tanstack#protecting-resources
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await (await createAuth()).api.getSession({ headers: getRequestHeaders() });
  return session && { user: { id: session.user.id, email: session.user.email } };
});

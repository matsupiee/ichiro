import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { createAuth } from "../server/services";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
};

// ログイン中のユーザー。未ログインなら null。画面の出し分けに使う値だけを返す
// https://www.better-auth.com/docs/integrations/tanstack#protecting-resources
export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ user: SessionUser } | null> => {
    const session = await (await createAuth()).api.getSession({ headers: getRequestHeaders() });
    if (!session) return null;
    const { id, name, email, emailVerified, image } = session.user;
    return { user: { id, name, email, emailVerified, image: image ?? null } };
  },
);

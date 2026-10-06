import type { Context as ApiContext } from "@ichiro/api/context";

import { ENV } from "./env.server";
import { createAuth, getDb, getStripe } from "./services";

// readSession が false のときは、ログイン状態を読まずに session を null にする
export async function createContext(
  request: Request,
  { readSession = true }: { readSession?: boolean } = {},
): Promise<ApiContext> {
  const db = getDb();
  const session = readSession
    ? await (await createAuth(db)).api.getSession({ headers: request.headers })
    : null;
  return {
    db,
    session,
    stripe: getStripe(),
    avatarStorage: ENV.AVATARS,
  };
}

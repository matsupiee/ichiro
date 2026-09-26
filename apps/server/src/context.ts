import type { Context as ApiContext } from "@ichiro/api/context";
import type { Context as HonoContext } from "hono";

import { ENV } from "./env.server";
import { createAuth, getDb, getMailer, getStripe } from "./services";

// readSession が false のときは、ログイン状態を読まずに session を null にする
export async function createContext(
  context: HonoContext,
  { readSession = true }: { readSession?: boolean } = {},
): Promise<ApiContext> {
  const db = getDb();
  const session = readSession
    ? await (await createAuth(db)).api.getSession({ headers: context.req.raw.headers })
    : null;
  return {
    db,
    session,
    stripe: getStripe(),
    mailer: getMailer(),
    avatarStorage: ENV.AVATARS,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

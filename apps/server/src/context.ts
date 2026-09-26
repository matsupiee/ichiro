import type { Context as ApiContext } from "@ichiro/api/context";
import type { Context as HonoContext } from "hono";

import { createAuth, getDb, getMailer, getStripe } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const db = await getDb();
  const session = await (
    await createAuth(db)
  ).api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    session,
    stripe: getStripe(),
    mailer: getMailer(),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

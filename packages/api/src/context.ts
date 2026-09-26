import type { Session } from "@ichiro/auth";
import type { Database } from "@ichiro/db";

import type { Mailer } from "./lib/mailer";

export type Context = {
  session: Session | null;
  db: Database;
  mailer: Mailer;
};

// protectedProcedure の中で使う、ログインずみの Context
export type AuthedContext = Context & { session: NonNullable<Context["session"]> };

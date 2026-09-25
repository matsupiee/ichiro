import type { Session } from "@ichiro/auth";
import type { Database } from "@ichiro/db";

export type Context = {
  session: Session | null;
  db: Database;
};

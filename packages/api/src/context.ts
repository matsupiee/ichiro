import type { Session } from "@ichiro/auth";
import type { Database } from "@ichiro/db";

import type { StripeClient } from "./lib/stripe";

export type Context = {
  session: Session | null;
  db: Database;
  stripe: StripeClient;
};

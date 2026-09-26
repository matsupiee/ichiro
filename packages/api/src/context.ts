import type { Session } from "@ichiro/auth";
import type { Database } from "@ichiro/db";

import type { AvatarStorage } from "./third-party-lib/avatar-storage";
import type { Mailer } from "./third-party-lib/mailer";
import type { StripeClient } from "./third-party-lib/stripe";

// tRPC と HTTP のどちらのルートからも使う Context
export type Context = {
  session: Session | null;
  db: Database;
  stripe: StripeClient;
  mailer: Mailer;
  avatarStorage: AvatarStorage;
};

// protectedProcedure・protectedHttpRoute の中で使う、ログインずみの Context
export type AuthedContext = Context & { session: NonNullable<Context["session"]> };

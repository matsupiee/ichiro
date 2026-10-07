import { createAuth as createConfiguredAuth } from "@ichiro/auth";
import { createStripe } from "@ichiro/api/third-party-lib/stripe";
import { type Database, createDb } from "@ichiro/db";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { createAuthMailer } from "./auth-mail";
import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}
export function getStripe() {
  return createStripe(ENV.STRIPE_SECRET_KEY);
}
export async function createAuth(database?: Database) {
  // サーバー関数から auth.api を呼んだときの Set-Cookie を、TanStack Start の応答に載せる
  return createConfiguredAuth(ENV, database ?? getDb(), createAuthMailer(ENV), [
    tanstackStartCookies(),
  ]);
}

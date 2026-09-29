import { createAuth as createConfiguredAuth } from "@ichiro/auth";
import { createStripe } from "@ichiro/api/third-party-lib/stripe";
import { type Database, createDb } from "@ichiro/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}
export function getStripe() {
  return createStripe(ENV.STRIPE_SECRET_KEY);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? (await getDb()));
}

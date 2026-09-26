import { createMailer } from "@ichiro/api/lib/mailer";
import { createAuth as createConfiguredAuth } from "@ichiro/auth";
import { type Database, createDb } from "@ichiro/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? (await getDb()));
}

export function getMailer() {
  return createMailer(ENV);
}

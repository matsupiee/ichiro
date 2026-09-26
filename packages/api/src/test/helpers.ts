import { createClient } from "@libsql/client";
import type { Session } from "@ichiro/auth";
import type { Database } from "@ichiro/db";
import { user } from "@ichiro/db/schema/index";
import { seedDemo } from "@ichiro/db/seed/index";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { appRouter } from "../routers/index";
import { createFakeStripe, type FakeStripe } from "./fake-stripe";

const migrationsFolder = new URL("../../../db/src/migrations", import.meta.url).pathname;

// テストでは D1 の代わりにメモリ上の SQLite を使う。
// クエリビルダーの API は同じなので、D1 用の Database 型として扱う。
export async function createTestDb() {
  const db = drizzle({ client: createClient({ url: ":memory:" }) });
  await migrate(db, { migrationsFolder });
  return db as unknown as Database;
}

// ユーザーの現地日付の代わりに、サーバーと同じ UTC の今日を使う
export function testToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function sessionFor(db: Database, email: string): Promise<Session> {
  const [u] = await db.select().from(user).where(eq(user.email, email));
  if (!u) throw new Error(`user not found: ${email}`);
  return {
    user: { ...u, image: u.image ?? null },
    session: {
      id: `session-${u.id}`,
      userId: u.id,
      token: `token-${u.id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as Session;
}

export async function createUser(db: Database, email: string, name = "friend") {
  await db.insert(user).values({ id: `user-${email}`, name, email, updatedAt: new Date() });
  return sessionFor(db, email);
}

export function callerFor(
  db: Database,
  session: Session | null,
  stripe: FakeStripe = createFakeStripe(),
) {
  return appRouter.createCaller({ db, session, stripe: stripe.client });
}

export async function setupDemo() {
  const db = await createTestDb();
  const today = testToday();
  const seeded = await seedDemo(db as never, today, "UTC");
  const session = await sessionFor(db, "demo@ichiro.app");
  const stripe = createFakeStripe();
  return { db, today, session, seeded, stripe, caller: callerFor(db, session, stripe) };
}

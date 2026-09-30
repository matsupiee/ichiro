import type { Database } from "@ichiro/db";
import { authRateLimit } from "@ichiro/db/schema/auth";
import { eq, or, lt, lte, sql } from "drizzle-orm";

// DB の単一 UPSERT で判定する。Worker の再起動・並列実行でも上限を共有する。
export function createRateLimiter(db: Database, secret: string) {
  const fingerprint = async (value: string) => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  return {
    fingerprint,
    async consume(identity: string, rule: { window: number; max: number }) {
      const key = await fingerprint(identity);
      const now = Date.now();
      const expiresAt = now + rule.window * 1000;
      const [accepted] = await db
        .insert(authRateLimit)
        .values({ key, count: 1, expiresAt })
        .onConflictDoUpdate({
          target: authRateLimit.key,
          set: {
            count: sql`case when ${authRateLimit.expiresAt} <= ${now} then 1 else ${authRateLimit.count} + 1 end`,
            expiresAt: sql`case when ${authRateLimit.expiresAt} <= ${now} then ${expiresAt} else ${authRateLimit.expiresAt} end`,
          },
          setWhere: or(lte(authRateLimit.expiresAt, now), lt(authRateLimit.count, rule.max)),
        })
        .returning({ key: authRateLimit.key });
      if (accepted) return { allowed: true, retryAfter: null };
      const [row] = await db.select().from(authRateLimit).where(eq(authRateLimit.key, key));
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(((row?.expiresAt ?? expiresAt) - now) / 1000)),
      };
    },
  };
}

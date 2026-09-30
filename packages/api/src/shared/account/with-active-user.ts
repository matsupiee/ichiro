import type { Database } from "@ichiro/db";
import { user } from "@ichiro/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

// 退会後に開始する操作を拒否する。開始済みの操作は中断しない。
export async function withActiveUser<T>(
  db: Database,
  userId: string,
  run: () => Promise<T>,
): Promise<T> {
  const [row] = await db
    .select({ withdrawnAt: user.withdrawnAt })
    .from(user)
    .where(eq(user.id, userId));
  if (!row || row.withdrawnAt)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "退会済みです" });
  return run();
}

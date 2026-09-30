// ローカル専用。既存ユーザーに触れず、退会の確認に使う専用アカウントを作成する。
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { account, user } from "../schema/auth";
import { commitment } from "../schema/commitment";
import type { SeedDatabase } from "./index";

export const WITHDRAWAL_USER = {
  id: "withdrawal-demo",
  email: "withdrawal@ichiro.example",
  name: "退会テスト",
  password: "withdrawal-demo-password",
};
export async function seedWithdrawal(db: SeedDatabase, email = WITHDRAWAL_USER.email) {
  if (!/^[a-z0-9-]+@ichiro\.example$/.test(email))
    throw new Error(
      "テスト用メールアドレスは英小文字・数字・ハイフンと @ichiro.example を指定してください",
    );
  const { name, password } = WITHDRAWAL_USER;
  const id = email === WITHDRAWAL_USER.email ? WITHDRAWAL_USER.id : `withdrawal-${email}`;
  const [existing] = await db.select().from(user).where(eq(user.id, id));
  if (existing)
    throw new Error(
      "退会テスト用ユーザーは既に存在します。再実行には別の --email を指定してください",
    );
  await db.insert(user).values({ id, email, name, emailVerified: true });
  await db
    .insert(account)
    .values({
      id,
      userId: id,
      accountId: id,
      providerId: "credential",
      password: await hashPassword(password),
      updatedAt: new Date(),
    });
  await db
    .insert(commitment)
    .values({
      id: `${id}-commitment`,
      userId: id,
      goal: "退会動作の確認",
      content: "毎日記録する",
      frequency: "daily",
      weekdays: [],
      monthDays: [],
      startDate: "2026-01-01",
      untilDate: "2099-12-31",
      penaltyAmount: null,
      settledThrough: "2026-01-01",
    });
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      url: { type: "string" },
      "skip-migrations": { type: "boolean" },
    },
  });
  if (!values.url?.startsWith("file:"))
    throw new Error("--url file:... でローカルDBを指定してください");
  const client = createClient({ url: values.url });
  try {
    const db = drizzle({ client });
    if (!values["skip-migrations"])
      await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
    await seedWithdrawal(db, values.email);
    console.log(
      `退会テスト用: ${values.email ?? WITHDRAWAL_USER.email} / ${WITHDRAWAL_USER.password}`,
    );
  } finally {
    client.close();
  }
}

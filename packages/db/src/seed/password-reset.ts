// ローカル専用。パスワード再設定の動作確認用ユーザーを作る。
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { account, session, user, verification } from "../schema/auth";
import type { SeedDatabase } from "./index";

export const PASSWORD_RESET_USER = {
  id: "password-reset-demo",
  email: "password-reset@ichiro.example",
  name: "パスワード再設定",
  password: "reset-demo-password",
};

export async function seedPasswordReset(db: SeedDatabase) {
  const { id, email, name, password } = PASSWORD_RESET_USER;
  const passwordHash = await hashPassword(password);
  await db.delete(session).where(eq(session.userId, id));
  await db.delete(verification).where(like(verification.identifier, `%${email}`));
  await db
    .insert(user)
    .values({ id, name, email, emailVerified: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: user.id,
      set: { name, email, emailVerified: true, updatedAt: new Date() },
    });
  await db
    .insert(account)
    .values({
      id,
      userId: id,
      accountId: id,
      providerId: "credential",
      password: passwordHash,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: account.id,
      set: { password: passwordHash, updatedAt: new Date() },
    });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      "skip-migrations": { type: "boolean" },
    },
  });
  if (!values.url?.startsWith("file:"))
    throw new Error("認証用 seed は --url file:... でローカル DB を指定してください");
  const client = createClient({ url: values.url });
  try {
    const db = drizzle({ client });
    if (!values["skip-migrations"])
      await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
    await seedPasswordReset(db);
    console.log(
      `パスワード再設定用ユーザーを作成しました: ${PASSWORD_RESET_USER.email} / ${PASSWORD_RESET_USER.password}`,
    );
    console.log(
      "AUTH_EMAIL_DELIVERY=console のローカル API でコードを再送してください。回数制限は維持します。",
    );
  } finally {
    client.close();
  }
}

// ローカル専用。登録確認・メール変更の動作確認用ユーザーを作る。
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { account, session, user, verification } from "../schema/auth";
import type { SeedDatabase } from "./index";

export const OTP_USER = {
  id: "email-verification-demo",
  email: "otp@ichiro.example",
  name: "メール確認",
  password: "otp-demo-password",
};

export async function seedEmailVerification(db: SeedDatabase, emailVerified = false) {
  const { id, email, name, password } = OTP_USER;
  await db.delete(session).where(eq(session.userId, id));
  await db.delete(verification).where(like(verification.identifier, `%${email}`));
  await db
    .insert(user)
    .values({ id, name, email, emailVerified, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: user.id,
      set: { name, email, emailVerified, updatedAt: new Date() },
    });
  await db
    .insert(account)
    .values({
      id,
      userId: id,
      accountId: id,
      providerId: "credential",
      password: await hashPassword(password),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: account.id,
      set: { password: await hashPassword(password), updatedAt: new Date() },
    });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      "skip-migrations": { type: "boolean" },
      verified: { type: "boolean" },
    },
  });
  if (!values.url?.startsWith("file:"))
    throw new Error("認証用 seed は --url file:... でローカル DB を指定してください");
  const client = createClient({ url: values.url });
  try {
    const db = drizzle({ client });
    if (!values["skip-migrations"])
      await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
    await seedEmailVerification(db, values.verified);
    console.log(`メール確認用ユーザーを作成しました: ${OTP_USER.email} / ${OTP_USER.password}`);
    console.log(
      "AUTH_EMAIL_DELIVERY=console のローカル API でコードを再送してください。回数制限は維持します。",
    );
  } finally {
    client.close();
  }
}

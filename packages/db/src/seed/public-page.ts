// 紹介ページの撮影専用。既存のデモユーザーには触らず、ローカル SQLite だけに投入する。
// bun run --cwd packages/db db:seed:public-page --url file:/absolute/path/to/local.sqlite
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { account, user } from "../schema/auth";
import { commitment } from "../schema/commitment";
import { report } from "../schema/report";
import { localToday, localTimeZone, type SeedDatabase } from "./index";

export const PUBLIC_PAGE_USER = {
  id: "public-page-demo",
  email: "screenshots@ichiro.example",
  name: "いちろう",
  password: "screenshot-demo-only",
};

export async function seedPublicPage(
  db: SeedDatabase,
  today = localToday(),
  timeZone = localTimeZone(),
) {
  const day = (offset: number) => {
    const value = new Date(`${today}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const { id, email, name, password } = PUBLIC_PAGE_USER;
  // この専用アカウントに請求がある場合は FK 制約で停止し、履歴は削除しない。
  await db.delete(commitment).where(eq(commitment.userId, id));
  await db
    .insert(user)
    .values({ id, email, name, emailVerified: true, updatedAt: new Date() })
    .onConflictDoNothing();
  await db
    .insert(account)
    .values({
      id,
      accountId: id,
      userId: id,
      providerId: "credential",
      password: await hashPassword(password),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
  const goals = [
    ["朝の読書", "毎朝、本を10ページ読む"],
    ["英語を習慣に", "毎日15分、英語の練習をする"],
    ["からだを動かす", "夕方に20分ウォーキングする"],
  ] as const;
  for (const [index, [goal, content]] of goals.entries()) {
    const commitmentId = `${id}-${index}`;
    await db.insert(commitment).values({
      id: commitmentId,
      userId: id,
      goal,
      content,
      frequency: "daily",
      weekdays: [1],
      monthDays: [1],
      startDate: day(-6),
      untilDate: day(30),
      penaltyAmount: null,
      timeZone,
      settledThrough: day(-1),
      createdAt: new Date(Date.now() - index * 1000),
    });
    for (let offset = -6; offset < 0; offset++) {
      await db.insert(report).values({ commitmentId, reportDate: day(offset) });
    }
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { url: { type: "string" }, "skip-migrations": { type: "boolean" } },
  });
  if (!values.url?.startsWith("file:"))
    throw new Error("撮影用 seed は --url file:... でローカル DB を指定してください");
  const client = createClient({ url: values.url });
  try {
    const db = drizzle({ client });
    if (!values["skip-migrations"])
      await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
    await seedPublicPage(db);
    console.log(
      `撮影用データを作成しました: ${PUBLIC_PAGE_USER.email} / ${PUBLIC_PAGE_USER.password}`,
    );
  } finally {
    client.close();
  }
}

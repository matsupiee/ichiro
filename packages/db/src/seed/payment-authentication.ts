// 実決済を呼ばず、追加認証による請求停止の履歴をネイティブで確認するローカル専用 seed。
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { commitment } from "../schema/commitment";
import { penalty } from "../schema/penalty";
import { localToday, type SeedDatabase } from "./index";
import { seedWithdrawal, WITHDRAWAL_USER } from "./withdrawal";

export async function seedPaymentAuthentication(
  db: SeedDatabase,
  email = "auth-stop@ichiro.example",
) {
  await seedWithdrawal(db, email);
  const id = email === WITHDRAWAL_USER.email ? WITHDRAWAL_USER.id : `withdrawal-${email}`;
  const today = localToday();
  await db
    .update(commitment)
    .set({ content: "追加認証で請求停止", settledThrough: today })
    .where(eq(commitment.id, `${id}-commitment`));
  await db.insert(penalty).values({
    id: `${id}-authentication`,
    userId: id,
    commitmentId: `${id}-commitment`,
    dueDate: today,
    amount: 500,
    status: "failed",
    attempts: 1,
    retryStoppedAt: new Date(),
    failureMessage: "カードの本人認証が必要なため、この報告日分の自動請求を停止しました",
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      email: { type: "string" },
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
    await seedPaymentAuthentication(db, values.email);
    console.log(
      `確認用: ${values.email ?? "auth-stop@ichiro.example"} / ${WITHDRAWAL_USER.password}`,
    );
  } finally {
    client.close();
  }
}

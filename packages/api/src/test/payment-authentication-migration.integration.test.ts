import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const migrations = new URL("../../../db/src/migrations", import.meta.url).pathname;
const change = "20261003083241_stop_authentication_retry";

test("既存の本人認証失敗分だけを停止し、成功済み・通常拒否と実際の試行回数を保持する", async () => {
  const before = mkdtempSync(join(tmpdir(), "ichiro-authentication-"));
  const client = createClient({ url: ":memory:" });
  try {
    for (const dir of readdirSync(migrations).filter((d) => d < change))
      cpSync(join(migrations, dir), join(before, dir), { recursive: true });
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: before });
    await client.execute("INSERT INTO user(id,name,email) VALUES ('u','u','u@example.com')");
    await client.execute(
      "INSERT INTO commitment(id,user_id,content,frequency,weekdays,month_days,start_date,until_date) VALUES ('c','u','test','daily','[]','[]','2026-01-01','2026-12-31')",
    );
    for (const [id, status, message] of [
      ["auth", "failed", "カードの本人認証が必要なため引き落とせませんでした"],
      ["declined", "failed", "カードが拒否されました"],
      ["paid", "paid", null],
    ]) {
      await client.execute({
        sql: "INSERT INTO penalty(id,user_id,commitment_id,due_date,amount,status,attempts,failure_message,updated_at) VALUES (?,'u','c',?,500,?,1,?,1234)",
        args: [id!, id!, status!, message ?? null],
      });
    }
    await migrate(db, { migrationsFolder: migrations });
    const rows = (
      await client.execute("SELECT id,status,attempts,retry_stopped_at FROM penalty ORDER BY id")
    ).rows;
    expect(rows).toMatchObject([
      { id: "auth", status: "failed", attempts: 1, retry_stopped_at: 1234 },
      { id: "declined", status: "failed", attempts: 1, retry_stopped_at: null },
      { id: "paid", status: "paid", attempts: 1, retry_stopped_at: null },
    ]);
  } finally {
    client.close();
    rmSync(before, { recursive: true, force: true });
  }
});

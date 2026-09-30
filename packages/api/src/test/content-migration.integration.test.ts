import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const migrations = new URL("../../../db/src/migrations", import.meta.url).pathname;
const removal = "20260930152928_remove_commitment_goal";

test("goal を削除しても content・報告・罰金・過去の履歴を保持し、新しい履歴は content のみになる", async () => {
  const before = mkdtempSync(join(tmpdir(), "ichiro-content-"));
  const client = createClient({ url: ":memory:" });
  try {
    for (const dir of readdirSync(migrations).filter((d) => d < removal))
      cpSync(join(migrations, dir), join(before, dir), { recursive: true });
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: before });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(
      "INSERT INTO user(id,name,email) VALUES ('u','user','content@example.com')",
    );
    await client.execute(
      "INSERT INTO commitment(id,user_id,goal,content,frequency,weekdays,month_days,start_date,until_date) VALUES ('c','u','読書','10ページ読む','daily','[]','[]','2026-09-01','2026-12-31')",
    );
    await client.execute("UPDATE commitment SET content = '20ページ読む' WHERE id = 'c'");
    await client.execute(
      "INSERT INTO report(id,commitment_id,report_date) VALUES ('r','c','2026-09-01')",
    );
    await client.execute(
      "INSERT INTO penalty(id,user_id,commitment_id,due_date,amount) VALUES ('p','u','c','2026-09-02',500)",
    );
    const logs = (await client.execute("SELECT * FROM commitment_log")).rows;
    await migrate(db, { migrationsFolder: migrations });
    expect(
      (await client.execute("PRAGMA table_info(commitment)")).rows.map((r) => r.name),
    ).not.toContain("goal");
    expect((await client.execute("SELECT content FROM commitment")).rows[0]!.content).toBe(
      "20ページ読む",
    );
    expect((await client.execute("SELECT * FROM commitment_log")).rows).toEqual(logs);
    expect((await client.execute("SELECT * FROM report")).rows).toHaveLength(1);
    expect((await client.execute("SELECT amount FROM penalty")).rows[0]!.amount).toBe(500);
    await client.execute("UPDATE commitment SET content = '30ページ読む' WHERE id = 'c'");
    const latest = (
      await client.execute("SELECT snapshot FROM commitment_log ORDER BY id DESC LIMIT 1")
    ).rows[0]!;
    expect(JSON.parse(String(latest.snapshot))).toMatchObject({ content: "20ページ読む" });
    expect(JSON.parse(String(latest.snapshot))).not.toHaveProperty("goal");
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  } finally {
    client.close();
    rmSync(before, { recursive: true, force: true });
  }
});

import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const migrations = new URL("../../../db/src/migrations", import.meta.url).pathname;
const sharingMigration = "20260929091452_harsh_korvac";

test("メール招待から共有リンクへの移行は既存の宣言・報告・罰金を保持する", async () => {
  const before = mkdtempSync(join(tmpdir(), "ichiro-share-migration-"));
  const client = createClient({ url: ":memory:" });
  try {
    for (const dir of readdirSync(migrations).filter((d) => d < sharingMigration))
      cpSync(join(migrations, dir), join(before, dir), { recursive: true });
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: before });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("INSERT INTO user(id,name,email) VALUES ('u','taro','demo@example.com')");
    for (const checker of ["self", "friend"]) {
      await client.execute({
        sql: `INSERT INTO commitment(id,user_id,goal,content,frequency,weekdays,month_days,start_date,until_date,checker,friend_email) VALUES (?, 'u', '読書', '10ページ', 'daily', '[]', '[]', '2026-09-01', '2026-12-31', ?, ?)`,
        args: [checker, checker, checker === "friend" ? "friend@example.com" : null],
      });
    }
    await client.execute(
      "INSERT INTO report(id,commitment_id,report_date) VALUES ('r','friend','2026-09-01')",
    );
    await client.execute(
      "INSERT INTO penalty(id,user_id,commitment_id,due_date,amount) VALUES ('p','u','friend','2026-09-02',500)",
    );
    await client.execute(
      "INSERT INTO invitation(id,commitment_id,email,kind,status) VALUES ('i','friend','friend@example.com','sign_up','sent')",
    );
    await migrate(db, { migrationsFolder: migrations });
    const rows = (await client.execute("SELECT id FROM commitment ORDER BY id")).rows;
    expect(rows).toHaveLength(2);
    expect((await client.execute("SELECT * FROM report")).rows).toHaveLength(1);
    expect((await client.execute("SELECT amount FROM penalty")).rows[0]!.amount).toBe(500);
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
    expect(
      (await client.execute("PRAGMA table_info(commitment)")).rows.map((r) => r.name),
    ).not.toContain("friend_email");
    expect(
      (await client.execute("SELECT name FROM sqlite_master WHERE name = 'invitation'")).rows,
    ).toHaveLength(0);
  } finally {
    client.close();
    rmSync(before, { recursive: true, force: true });
  }
});

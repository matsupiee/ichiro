import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const migrations = new URL("../../../db/src/migrations", import.meta.url).pathname;
const removal = "20260930065419_remove_friend_checking";

test("友達と招待中の設定を廃止しても報告・罰金・変更履歴を保持する", async () => {
  const before = mkdtempSync(join(tmpdir(), "ichiro-self-check-"));
  const client = createClient({ url: ":memory:" });
  try {
    for (const dir of readdirSync(migrations).filter((d) => d < removal))
      cpSync(join(migrations, dir), join(before, dir), { recursive: true });
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: before });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(
      "INSERT INTO user(id,name,email) VALUES ('owner','owner','owner@example.com'), ('friend','friend','friend@example.com')",
    );
    for (const id of ["self", "pending", "assigned"]) {
      await client.execute({
        sql: `INSERT INTO commitment(id,user_id,goal,content,frequency,weekdays,month_days,start_date,until_date,checker,checker_user_id,share_token) VALUES (?, 'owner', '読書', '10ページ', 'daily', '[]', '[]', '2026-09-01', '2026-12-31', ?, ?, ?)`,
        args: [
          id,
          id === "assigned" ? "friend" : "self",
          id === "assigned" ? "friend" : null,
          id === "pending" ? "old-token" : null,
        ],
      });
    }
    await client.execute("UPDATE commitment SET goal = '変更後' WHERE id = 'assigned'");
    const previous = (await client.execute("SELECT * FROM commitment_log")).rows;
    await client.execute(
      "INSERT INTO report(id,commitment_id,report_date) VALUES ('r','assigned','2026-09-01')",
    );
    await client.execute(
      "INSERT INTO penalty(id,user_id,commitment_id,due_date,amount) VALUES ('p','owner','assigned','2026-09-02',500)",
    );
    await migrate(db, { migrationsFolder: migrations });
    expect((await client.execute("SELECT * FROM commitment")).rows).toHaveLength(3);
    const columns = (await client.execute("PRAGMA table_info(commitment)")).rows.map((r) => r.name);
    for (const column of ["checker", "checker_user_id", "share_token"])
      expect(columns).not.toContain(column);
    expect((await client.execute("SELECT * FROM report")).rows).toHaveLength(1);
    expect((await client.execute("SELECT amount FROM penalty")).rows[0]!.amount).toBe(500);
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
    const logs = (await client.execute("SELECT * FROM commitment_log ORDER BY id")).rows;
    expect(logs).toHaveLength(3);
    expect(logs[0]).toEqual(previous[0]);
    expect(
      logs.map((r) => JSON.parse(String(r.snapshot))).some((s) => s.checkerUserId === "friend"),
    ).toBe(true);
    await client.execute("UPDATE commitment SET content = 'セルフチェック' WHERE id = 'assigned'");
    const latest = (
      await client.execute("SELECT snapshot FROM commitment_log ORDER BY id DESC LIMIT 1")
    ).rows[0]!;
    expect(JSON.parse(String(latest.snapshot)).content).toBe("10ページ");
    expect(JSON.parse(String(latest.snapshot))).not.toHaveProperty("checker");
  } finally {
    client.close();
    rmSync(before, { recursive: true, force: true });
  }
});

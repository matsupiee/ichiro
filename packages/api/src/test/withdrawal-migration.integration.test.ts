import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const migrations = new URL("../../../db/src/migrations", import.meta.url).pathname;
const simplification = "20260930084329_brave_lady_bullseye";

test("退会受付済みの日時を引き継ぎ、退会状態を1カラムに統一する", async () => {
  const before = mkdtempSync(join(tmpdir(), "ichiro-withdrawal-"));
  const client = createClient({ url: ":memory:" });
  try {
    for (const dir of readdirSync(migrations).filter((d) => d < simplification))
      cpSync(join(migrations, dir), join(before, dir), { recursive: true });
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: before });
    await client.execute(`INSERT INTO user(id,name,email,withdrawal_requested_at,withdrawn_at,active_operations)
      VALUES ('active','active','active@example.com',NULL,NULL,0),
             ('pending','pending','pending@example.com',1000,NULL,1),
             ('done','done','done@example.com',1000,2000,0)`);
    await migrate(db, { migrationsFolder: migrations });
    expect(
      (await client.execute("SELECT id,withdrawn_at FROM user ORDER BY id")).rows.map((row) => ({
        id: row.id,
        withdrawn_at: row.withdrawn_at,
      })),
    ).toEqual([
      { id: "active", withdrawn_at: null },
      { id: "done", withdrawn_at: 2000 },
      { id: "pending", withdrawn_at: 1000 },
    ]);
    const columns = (await client.execute("PRAGMA table_info(user)")).rows.map((r) => r.name);
    expect(columns).not.toContain("withdrawal_requested_at");
    expect(columns).not.toContain("active_operations");
    for (const id of ["done", "pending"]) {
      await expect(
        client.execute({
          sql: "INSERT INTO session(id,user_id,token,expires_at,updated_at) VALUES (?,?,?,9999999999999,0)",
          args: [id, id, id],
        }),
      ).rejects.toThrow("ACCOUNT_WITHDRAWN");
    }
    await client.execute(
      "INSERT INTO session(id,user_id,token,expires_at,updated_at) VALUES ('active','active','active',9999999999999,0)",
    );
  } finally {
    client.close();
    rmSync(before, { recursive: true, force: true });
  }
});

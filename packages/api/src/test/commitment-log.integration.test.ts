import { describe, expect, test } from "bun:test";
import { commitment, commitmentLog } from "@ichiro/db/schema/index";
import { eq, sql } from "drizzle-orm";

import { callerFor, createUser, setupDemo } from "./helpers";

const values = {
  content: "毎日10ページ読む\n感想を書く",
  frequency: "weekly" as const,
  weekdays: [1, 3, 5],
  monthDays: [],
  untilDate: "2099-12-31",
  penaltyAmount: null,
  paymentMethodId: null,
};

function snapshot(row: typeof commitment.$inferSelect) {
  return { ...row, createdAt: row.createdAt.getTime(), updatedAt: row.updatedAt.getTime() };
}

async function logs(db: Awaited<ReturnType<typeof setupDemo>>["db"], id: string) {
  return db
    .select()
    .from(commitmentLog)
    .where(eq(commitmentLog.commitmentId, id))
    .orderBy(commitmentLog.id);
}

describe("commitment の更新前の内容を保存する", () => {
  test("新規作成では記録せず、連続した編集で全項目と変更前の金額・支払い方法を順に残す", async () => {
    const { db, caller, today, seeded } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, timeZone: "UTC", values });
    expect(await logs(db, created.id)).toEqual([]);
    const [before] = await db.select().from(commitment).where(eq(commitment.id, created.id));
    await caller.consumer.commitment.update({
      id: created.id,
      values: { ...values, penaltyAmount: 500, paymentMethodId: seeded.paymentMethodIds[0]! },
    });
    const [middle] = await db.select().from(commitment).where(eq(commitment.id, created.id));
    await caller.consumer.commitment.update({
      id: created.id,
      timeZone: "Asia/Tokyo",
      values: { ...values, penaltyAmount: 2000, paymentMethodId: seeded.paymentMethodIds[1]! },
    });
    const rows = await logs(db, created.id);
    expect(rows.map((row) => row.snapshot)).toEqual([snapshot(before!), snapshot(middle!)]);
    expect(rows[0]!.loggedAt.getTime()).toBeGreaterThanOrEqual(before!.createdAt.getTime());
    const [after] = await db.select().from(commitment).where(eq(commitment.id, created.id));
    expect(after).toMatchObject({ penaltyAmount: 2000, timeZone: "Asia/Tokyo" });
    // 型だけでなくキーも比較するため、列追加時のトリガーの更新漏れも検出できる。
    expect(Object.keys(rows[0]!.snapshot).sort()).toEqual(Object.keys(after!).sort());
  });

  test("精算による更新も記録する", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, timeZone: "UTC", values });
    const [before] = await db.select().from(commitment).where(eq(commitment.id, created.id));
    await db.update(commitment).set({ settledThrough: today }).where(eq(commitment.id, created.id));
    const rows = await logs(db, created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.snapshot).toEqual(snapshot(before!));
  });

  test("権限エラー・入力エラー・DB 制約違反では履歴を増やさない", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, timeZone: "UTC", values });
    const other = callerFor(db, await createUser(db, "log-other@example.com"));
    await expect(other.consumer.commitment.update({ id: created.id, values })).rejects.toThrow();
    await expect(
      caller.consumer.commitment.update({
        id: created.id,
        values: { ...values, penaltyAmount: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      db
        .update(commitment)
        .set({ content: sql`NULL` })
        .where(eq(commitment.id, created.id))
        .execute(),
    ).rejects.toThrow();
    expect(await logs(db, created.id)).toEqual([]);
  });

  test("履歴の保存に失敗した場合、commitment の更新もロールバックする", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, timeZone: "UTC", values });
    await db.run(
      sql`CREATE TRIGGER reject_commitment_log BEFORE INSERT ON commitment_log BEGIN SELECT RAISE(ABORT, 'log unavailable'); END`,
    );
    await expect(
      caller.consumer.commitment.update({
        id: created.id,
        values: { ...values, content: "保存されない" },
      }),
    ).rejects.toThrow();
    const [after] = await db.select().from(commitment).where(eq(commitment.id, created.id));
    expect(after!.content).toBe(values.content);
    expect(await logs(db, created.id)).toEqual([]);
  });

  test("同時の更新でも途中の値を残し、元データ削除後も履歴を保持する", async () => {
    const { db, caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({ today, timeZone: "UTC", values });
    await Promise.all(
      ["更新A", "更新B"].map((content) =>
        db.update(commitment).set({ content }).where(eq(commitment.id, created.id)),
      ),
    );
    const rows = await logs(db, created.id);
    const [after] = await db.select().from(commitment).where(eq(commitment.id, created.id));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.snapshot.content).toBe(values.content);
    expect(new Set([rows[1]!.snapshot.content, after!.content])).toEqual(
      new Set(["更新A", "更新B"]),
    );
    await db.delete(commitment).where(eq(commitment.id, created.id));
    expect(await logs(db, created.id)).toEqual(rows);
  });
});

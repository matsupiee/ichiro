import { describe, expect, test } from "bun:test";
import { commitment, penalty, user } from "@ichiro/db/schema/index";
import { eq, sql } from "drizzle-orm";

import { createUser, setupDemo } from "../../test/helpers";

describe("罰金の履歴を削除から保護する", () => {
  test("罰金のあるコミットメントは削除できず、履歴も残る", async () => {
    const { db, seeded } = await setupDemo();
    await db.run(sql`PRAGMA foreign_keys = ON`);
    const id = seeded.commitmentIds[0]!;
    const before = await db.select().from(penalty).where(eq(penalty.commitmentId, id));
    expect(before.length).toBeGreaterThan(0);

    await expect(db.delete(commitment).where(eq(commitment.id, id)).execute()).rejects.toThrow();

    expect(await db.select().from(penalty).where(eq(penalty.commitmentId, id))).toEqual(before);
    expect(await db.select().from(commitment).where(eq(commitment.id, id))).toHaveLength(1);
  });

  test("罰金から参照されるユーザーは削除できず、履歴も残る", async () => {
    const { db, seeded } = await setupDemo();
    await db.run(sql`PRAGMA foreign_keys = ON`);
    // 他の外部キーに妨げられず、penalty.user_id 自体の削除制約を確認する。
    const session = await createUser(db, "penalty-owner@example.com");
    const [row] = await db
      .insert(penalty)
      .values({
        userId: session.user.id,
        commitmentId: seeded.commitmentIds[0]!,
        dueDate: "2000-01-01",
        amount: 500,
      })
      .returning();

    await expect(db.delete(user).where(eq(user.id, session.user.id)).execute()).rejects.toThrow();

    expect(await db.select().from(penalty).where(eq(penalty.id, row!.id))).toEqual([row!]);
    expect(await db.select().from(user).where(eq(user.id, session.user.id))).toHaveLength(1);
  });
});

import { expect, test } from "bun:test";
import { seedDemo } from "@ichiro/db/seed/index";
import { commitment, penalty, report, user } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { setupDemo } from "./helpers";

test("デモを再投入しても全ストーリー用のデータと共有リンクを作り直せる", async () => {
  const { db, today, seeded } = await setupDemo();
  const again = await seedDemo(db as never, today, "UTC");
  expect(again.userId).not.toBe(seeded.userId);
  expect(await db.select().from(user).where(eq(user.id, seeded.userId))).toHaveLength(0);
  const rows = await db.select().from(commitment).where(eq(commitment.userId, again.userId));
  expect(rows).toHaveLength(3);
  expect(rows.filter((c) => c.shareToken !== null)).toHaveLength(1);
  expect(await db.select().from(penalty).where(eq(penalty.userId, again.userId))).toHaveLength(2);
  expect((await db.select().from(report)).length).toBeGreaterThan(42);
});

test("編集履歴用の seed はトリガーで旧金額と支払い方法を記録する", async () => {
  const { seedCommitmentLog } = await import("@ichiro/db/seed/commitment-log");
  const { commitmentLog } = await import("@ichiro/db/schema/index");
  const { db, seeded } = await setupDemo();
  const id = seeded.commitmentIds[0]!;
  const [before] = await db.select().from(commitment).where(eq(commitment.id, id));
  await seedCommitmentLog(db as never, id, seeded.paymentMethodIds);
  const rows = await db
    .select()
    .from(commitmentLog)
    .where(eq(commitmentLog.commitmentId, id))
    .orderBy(commitmentLog.id);
  expect(rows.map((row) => [row.snapshot.penaltyAmount, row.snapshot.paymentMethodId])).toEqual([
    [before!.penaltyAmount, before!.paymentMethodId],
    [500, seeded.paymentMethodIds[0]!],
  ]);
  const [after] = await db.select().from(commitment).where(eq(commitment.id, id));
  expect(after).toMatchObject({ penaltyAmount: 1500, paymentMethodId: seeded.paymentMethodIds[1] });
});

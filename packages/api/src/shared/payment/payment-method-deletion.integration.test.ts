import { describe, expect, test } from "bun:test";
import { commitment, paymentMethod } from "@ichiro/db/schema/index";
import { eq, sql } from "drizzle-orm";

import { setupDemo } from "../../test/helpers";

describe("コミットメントの支払い方法を保持する", () => {
  test("参照中の支払い方法は削除できず、参照も残る", async () => {
    const { db, seeded } = await setupDemo();
    await db.run(sql`PRAGMA foreign_keys = ON`);
    const id = seeded.paymentMethodIds[0]!;
    const before = await db.select().from(commitment).where(eq(commitment.paymentMethodId, id));
    expect(before.length).toBeGreaterThan(0);

    await expect(
      db.delete(paymentMethod).where(eq(paymentMethod.id, id)).execute(),
    ).rejects.toThrow();

    expect(await db.select().from(commitment).where(eq(commitment.paymentMethodId, id))).toEqual(
      before,
    );
    expect(await db.select().from(paymentMethod).where(eq(paymentMethod.id, id))).toHaveLength(1);
  });

  test("参照されていない支払い方法は削除できる", async () => {
    const { db, seeded } = await setupDemo();
    await db.run(sql`PRAGMA foreign_keys = ON`);
    const [unused] = await db
      .insert(paymentMethod)
      .values({
        userId: seeded.userId,
        stripePaymentMethodId: "pm_unused",
        brand: "visa",
        last4: "4242",
      })
      .returning();

    await db.delete(paymentMethod).where(eq(paymentMethod.id, unused!.id));
    expect(
      await db.select().from(paymentMethod).where(eq(paymentMethod.id, unused!.id)),
    ).toHaveLength(0);
  });
});

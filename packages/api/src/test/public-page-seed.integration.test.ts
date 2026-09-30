import { expect, test } from "bun:test";
import { PUBLIC_PAGE_USER, seedPublicPage } from "@ichiro/db/seed/public-page";
import { createTestDb, callerFor, sessionFor, testToday } from "./helpers";

test("紹介ページの撮影データで、目標一覧・連続達成・報告を確認できる", async () => {
  const db = await createTestDb();
  const today = testToday();
  await seedPublicPage(db, today, "UTC");
  await seedPublicPage(db, today, "UTC");
  const caller = callerFor(db, await sessionFor(db, PUBLIC_PAGE_USER.email));
  const items = await caller.consumer.commitment.list({ today });
  expect(items).toHaveLength(3);
  expect(items.map((item) => item.content)).toContain("毎朝、本を10ページ読む");
  expect(items.every((item) => item.penaltyAmount === null)).toBe(true);
  const detail = await caller.consumer.commitment.get({ id: items[0]!.id, today });
  expect(detail.streak).toBe(6);
  expect(detail.penalties).toHaveLength(0);
  const result = await caller.consumer.commitment.report({ id: items[0]!.id, today });
  expect(result.streak).toBe(7);
});

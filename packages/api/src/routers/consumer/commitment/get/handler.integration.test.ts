import { describe, expect, test } from "bun:test";

import { addDays } from "../../../../shared/date/add-days";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("コミットメントの詳細を見られる", () => {
  test("詳細には今週の達成状況が月曜はじまりで入る", async () => {
    const { caller, today, seeded } = await setupDemo();
    const detail = await caller.consumer.commitment.get({ id: seeded.commitmentIds[2]!, today });

    expect(detail.goal).toBe("禁煙");
    expect(detail.week).toHaveLength(7);
    expect(new Date(`${detail.week[0]!.date}T00:00:00Z`).getUTCDay()).toBe(1);
    const todayCell = detail.week.find((d) => d.date === today)!;
    expect(todayCell.reported).toBe(true);
    expect(detail.week.filter((d) => d.date > today).every((d) => !d.reported)).toBe(true);
  });

  test("罰金の記録が新しい順に入り、合計も返る", async () => {
    const { caller, today, seeded } = await setupDemo();
    const detail = await caller.consumer.commitment.get({ id: seeded.commitmentIds[0]!, today });

    expect(detail.penalties.map((p) => p.dueDate)).toEqual([
      addDays(today, -8),
      addDays(today, -15),
    ]);
    expect(detail.penalties[0]).toMatchObject({ amount: 500, status: "paid" });
    expect(detail.penaltyTotal).toBe(1000);
  });

  test("ほかのユーザーのコミットメントは見られない", async () => {
    const { db, today, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    await expect(
      other.consumer.commitment.get({ id: seeded.commitmentIds[0]!, today }),
    ).rejects.toThrow("コミットメントが見つかりません");
  });
});

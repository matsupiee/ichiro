import { describe, expect, test } from "bun:test";

import { addDays } from "../../../../shared/date/add-days";
import { runPenaltyJob } from "../../../../shared/penalty/run-penalty-job";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("今日の達成を報告できる", () => {
  test("報告すると連続達成が1つ増え、一覧でも報告ずみになる", async () => {
    const { caller, today, seeded } = await setupDemo();
    const id = seeded.commitmentIds[0]!;

    const result = await caller.consumer.commitment.report({ id, today });
    expect(result.streak).toBe(8);

    const item = (await caller.consumer.commitment.list({ today })).find((c) => c.id === id)!;
    expect(item).toMatchObject({ reportedToday: true, streak: 8 });
  });

  test("同じ日に二重には報告できない", async () => {
    const { caller, today, seeded } = await setupDemo();
    await expect(
      caller.consumer.commitment.report({ id: seeded.commitmentIds[2]!, today }),
    ).rejects.toThrow("今日はもう報告ずみです");
  });

  test("報告日でない日には報告できない", async () => {
    const { caller, today } = await setupDemo();
    const created = await caller.consumer.commitment.create({
      today,
      values: {
        goal: "読書",
        content: "本を1冊読みきる",
        frequency: "once",
        weekdays: [],
        monthDays: [],
        untilDate: addDays(today, 7),
        penaltyAmount: null,
        paymentMethodId: null,
      },
    });
    await expect(caller.consumer.commitment.report({ id: created.id, today })).rejects.toThrow(
      "今日は報告日ではありません",
    );
  });

  test("何日も前の日付では報告できない", async () => {
    const { caller, today, seeded } = await setupDemo();
    await expect(
      caller.consumer.commitment.report({
        id: seeded.commitmentIds[0]!,
        today: addDays(today, -3),
      }),
    ).rejects.toThrow("今日の日付が正しくありません");
  });

  test("締め切りを過ぎた日には、あとから報告できない", async () => {
    const { db, stripe, caller, today, seeded } = await setupDemo();
    // デモデータは UTC で作るので、翌日の 0:30（UTC）には今日の締め切りが過ぎている
    await runPenaltyJob(db, stripe.client, new Date(`${addDays(today, 1)}T00:30:00Z`));

    await expect(
      caller.consumer.commitment.report({ id: seeded.commitmentIds[0]!, today }),
    ).rejects.toThrow("締め切りを過ぎたため報告できません");
  });

  test("ほかのユーザーのコミットメントには報告できない", async () => {
    const { db, today, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    await expect(
      other.consumer.commitment.report({ id: seeded.commitmentIds[0]!, today }),
    ).rejects.toThrow("コミットメントが見つかりません");
  });
});

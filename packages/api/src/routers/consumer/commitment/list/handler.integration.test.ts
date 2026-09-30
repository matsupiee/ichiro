import { describe, expect, test } from "bun:test";

import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("メインページでコミットメントを一覧できる", () => {
  test("自分のコミットメントが新しい順に、今日の報告状況と連続達成つきで返る", async () => {
    const { caller, today } = await setupDemo();
    const list = await caller.consumer.commitment.list({ today });

    expect(list.map((c) => c.content)).toEqual([
      "毎日30分広東語を練習する",
      "週3でジムに行って、筋トレ45分と有酸素運動20分をやる",
      "禁煙する",
    ]);
    const cantonese = list.find((c) => c.content === "毎日30分広東語を練習する")!;
    expect(cantonese).toMatchObject({ dueToday: true, reportedToday: false, streak: 7 });
    const smoking = list.find((c) => c.content === "禁煙する")!;
    expect(smoking).toMatchObject({ dueToday: true, reportedToday: true, streak: 42 });
  });

  test("ほかのユーザーのコミットメントは見えない", async () => {
    const { db, today } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    expect(await other.consumer.commitment.list({ today })).toEqual([]);
  });

  test("ログインしていないと一覧できない", async () => {
    const { db, today } = await setupDemo();
    await expect(callerFor(db, null).consumer.commitment.list({ today })).rejects.toThrow(
      "Authentication required",
    );
  });

  test("何日もずれた今日の日付は受け付けない", async () => {
    const { caller } = await setupDemo();
    await expect(caller.consumer.commitment.list({ today: "2000-01-01" })).rejects.toThrow(
      "今日の日付が正しくありません",
    );
  });
});

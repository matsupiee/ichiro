import { expect, test } from "bun:test";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

test("自分の別のコミットメントで依頼している友達だけを重複なしで返す", async () => {
  const { caller, seeded } = await setupDemo();
  const id = seeded.commitmentIds[0]!;
  const friends = await caller.consumer.commitment.listCheckers({ id });
  expect(friends.map((f) => f.name)).toEqual(["tanaka"]);
  expect(friends[0]).not.toHaveProperty("email");
  expect(await caller.consumer.commitment.listCheckers({ id: seeded.commitmentIds[1]! })).toEqual(
    [],
  );
  await caller.consumer.commitment.setChecker({
    id: seeded.commitmentIds[2]!,
    selection: { mode: "friend", userId: friends[0]!.id },
  });
  expect(await caller.consumer.commitment.listCheckers({ id })).toEqual(friends);
});

test("他人の友達一覧と未ログインからの一覧取得を拒否する", async () => {
  const { db, seeded } = await setupDemo();
  for (const client of [
    callerFor(db, null),
    callerFor(db, await createUser(db, "stranger@example.com")),
  ]) {
    await expect(
      client.consumer.commitment.listCheckers({ id: seeded.commitmentIds[0]! }),
    ).rejects.toThrow();
  }
});

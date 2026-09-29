import { expect, test } from "bun:test";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

test("依頼を引き受けるとチェック者になり、別のコミットメントで友達として選べる", async () => {
  const { db, caller, seeded, today } = await setupDemo();
  const id = seeded.commitmentIds[0]!;
  const receiverSession = await createUser(db, "receiver@example.com", "hanako");
  const receiver = callerFor(db, receiverSession);
  const link = await caller.consumer.commitment.setChecker({ id, selection: { mode: "link" } });
  await receiver.consumer.commitment.acceptInvitation({ token: link.shareToken! });
  expect(await caller.consumer.commitment.get({ id, today })).toMatchObject({
    checker: "friend",
    checkerUser: { id: receiverSession.user.id },
    shareToken: null,
  });
  const friends = await caller.consumer.commitment.listCheckers({ id: seeded.commitmentIds[1]! });
  expect(friends.map((f) => f.name)).toContain("hanako");
  await expect(
    receiver.consumer.commitment.acceptInvitation({ token: link.shareToken! }),
  ).rejects.toThrow("利用できません");
});

test("自分・未ログインは承認できず、複数人の同時承認でも一人だけが設定される", async () => {
  const { db, caller, seeded } = await setupDemo();
  const link = await caller.consumer.commitment.setChecker({
    id: seeded.commitmentIds[0]!,
    selection: { mode: "link" },
  });
  const input = { token: link.shareToken! };
  await expect(caller.consumer.commitment.acceptInvitation(input)).rejects.toThrow();
  await expect(callerFor(db, null).consumer.commitment.acceptInvitation(input)).rejects.toThrow();
  const first = callerFor(db, await createUser(db, "first@example.com"));
  const second = callerFor(db, await createUser(db, "second@example.com"));
  const results = await Promise.allSettled([
    first.consumer.commitment.acceptInvitation(input),
    second.consumer.commitment.acceptInvitation(input),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});

test("チェック者を変更すると古いリンクで上書きできない", async () => {
  const { db, caller, seeded } = await setupDemo();
  const id = seeded.commitmentIds[0]!;
  const link = await caller.consumer.commitment.setChecker({ id, selection: { mode: "link" } });
  const [friend] = await caller.consumer.commitment.listCheckers({ id });
  await caller.consumer.commitment.setChecker({
    id,
    selection: { mode: "friend", userId: friend!.id },
  });
  const receiver = callerFor(db, await createUser(db, "receiver@example.com"));
  await expect(
    receiver.consumer.commitment.acceptInvitation({ token: link.shareToken! }),
  ).rejects.toThrow("利用できません");
});

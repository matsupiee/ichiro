import { expect, test } from "bun:test";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

test("アプリでログインした受取人に依頼内容だけを表示する", async () => {
  const { db, caller, seeded } = await setupDemo();
  const link = await caller.consumer.commitment.setChecker({
    id: seeded.commitmentIds[0]!,
    selection: { mode: "link" },
  });
  const receiver = callerFor(db, await createUser(db, "receiver@example.com"));
  const detail = await receiver.consumer.commitment.getInvitation({ token: link.shareToken! });
  expect(detail).toMatchObject({ ownerName: "taro", goal: "広東語マスター", isOwn: false });
  for (const key of ["ownerId", "email", "paymentMethodId", "shareToken"])
    expect(detail).not.toHaveProperty(key);
  expect((await caller.consumer.commitment.getInvitation({ token: link.shareToken! })).isOwn).toBe(
    true,
  );
  await expect(
    callerFor(db, null).consumer.commitment.getInvitation({ token: link.shareToken! }),
  ).rejects.toThrow("Authentication required");
});

test("不明・無効化済みの依頼リンクは内容を返さない", async () => {
  const { caller, seeded } = await setupDemo();
  const id = seeded.commitmentIds[0]!;
  const link = await caller.consumer.commitment.setChecker({ id, selection: { mode: "link" } });
  await caller.consumer.commitment.setChecker({ id, selection: { mode: "self" } });
  for (const token of [crypto.randomUUID(), link.shareToken!]) {
    await expect(caller.consumer.commitment.getInvitation({ token })).rejects.toThrow(
      "利用できません",
    );
  }
});

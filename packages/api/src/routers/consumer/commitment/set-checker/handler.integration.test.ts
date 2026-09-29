import { expect, test } from "bun:test";
import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

test("作成時は自分。依頼リンクを発行しても承認までは自分のまま", async () => {
  const { caller, today } = await setupDemo();
  const values = {
    goal: "読書",
    content: "10ページ",
    frequency: "daily" as const,
    weekdays: [],
    monthDays: [],
    untilDate: "2099-12-31",
    penaltyAmount: null,
    paymentMethodId: null,
    checker: "friend",
  };
  const created = await caller.consumer.commitment.create({ today, values });
  expect(created.checker).toBe("self");
  expect(created.shareToken).toBeNull();
  const link = await caller.consumer.commitment.setChecker({
    id: created.id,
    selection: { mode: "link" },
  });
  expect(link.checker).toBe("self");
  expect(link.checkerUserId).toBeNull();
  expect(link.shareToken).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    (await caller.consumer.commitment.setChecker({ id: created.id, selection: { mode: "link" } }))
      .shareToken,
  ).toBe(link.shareToken);
  await caller.consumer.commitment.update({ id: created.id, values });
  expect((await caller.consumer.commitment.get({ id: created.id, today })).shareToken).toBe(
    link.shareToken,
  );
});

test("ほかのコミットメントの友達を選べ、自分に戻すと依頼リンクも失効する", async () => {
  const { caller, seeded, today } = await setupDemo();
  const id = seeded.commitmentIds[0]!;
  const [friend] = await caller.consumer.commitment.listCheckers({ id });
  const selected = await caller.consumer.commitment.setChecker({
    id,
    selection: { mode: "friend", userId: friend!.id },
  });
  expect(selected.checkerUserId).toBe(friend!.id);
  expect((await caller.consumer.commitment.get({ id, today })).checkerUser?.name).toBe("tanaka");
  const link = await caller.consumer.commitment.setChecker({ id, selection: { mode: "link" } });
  expect(link.checkerUserId).toBe(friend!.id);
  const self = await caller.consumer.commitment.setChecker({ id, selection: { mode: "self" } });
  expect(self).toEqual({ checker: "self", checkerUserId: null, shareToken: null });
  await expect(
    caller.consumer.commitment.getInvitation({ token: link.shareToken! }),
  ).rejects.toThrow("利用できません");
});

test("未登録の候補・自分・他人のコミットメントは指定できない", async () => {
  const { db, caller, session, seeded } = await setupDemo();
  const otherSession = await createUser(db, "other@example.com");
  const id = seeded.commitmentIds[0]!;
  for (const userId of [session.user.id, otherSession.user.id, "unknown"]) {
    await expect(
      caller.consumer.commitment.setChecker({ id, selection: { mode: "friend", userId } }),
    ).rejects.toThrow("友達を選んでください");
  }
  for (const client of [callerFor(db, null), callerFor(db, otherSession)]) {
    await expect(
      client.consumer.commitment.setChecker({ id, selection: { mode: "link" } }),
    ).rejects.toThrow();
  }
});

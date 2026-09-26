import { describe, expect, test } from "bun:test";
import { invitation } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import { callerFor, createUser, setupDemo } from "../../../../test/helpers";

describe("招待メールを再送できる", () => {
  test("前回から1分たっていれば再送できる", async () => {
    const { db, caller, seeded, mailer } = await setupDemo();
    const id = seeded.commitmentIds[1]!;
    await db
      .update(invitation)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(invitation.commitmentId, id));

    const resent = await caller.consumer.commitment.resendInvitation({ id });
    expect(resent).toMatchObject({
      email: "matsukiyo@example.com",
      kind: "registered",
      status: "sent",
    });
    expect(mailer.outbox).toHaveLength(1);
  });

  test("送ったばかりなら再送できない", async () => {
    const { caller, seeded, mailer } = await setupDemo();
    await expect(
      caller.consumer.commitment.resendInvitation({ id: seeded.commitmentIds[1]! }),
    ).rejects.toThrow("少し時間をおいてから再送してください");
    expect(mailer.outbox).toHaveLength(0);
  });

  test("前回送れなかったなら、すぐに再送できる", async () => {
    const { caller, today, mailer } = await setupDemo();
    mailer.failing = true;
    const created = await caller.consumer.commitment.create({
      today,
      values: {
        goal: "読書",
        content: "毎日10ページ読む",
        frequency: "daily",
        weekdays: [],
        monthDays: [],
        untilDate: "2099-12-31",
        penaltyAmount: null,
        paymentMethodId: null,
        checker: "friend",
        friendEmail: "new-friend@example.com",
      },
    });
    mailer.failing = false;

    const resent = await caller.consumer.commitment.resendInvitation({ id: created.id });
    expect(resent.status).toBe("sent");
    const detail = await caller.consumer.commitment.get({ id: created.id, today });
    expect(detail.invitation?.status).toBe("sent");
  });

  test("自分でチェックするコミットメントには再送できない", async () => {
    const { caller, seeded } = await setupDemo();
    await expect(
      caller.consumer.commitment.resendInvitation({ id: seeded.commitmentIds[0]! }),
    ).rejects.toThrow("友達にチェックしてもらう設定になっていません");
  });

  test("ほかのユーザーのコミットメントには再送できない", async () => {
    const { db, seeded } = await setupDemo();
    const other = callerFor(db, await createUser(db, "other@example.com"));
    await expect(
      other.consumer.commitment.resendInvitation({ id: seeded.commitmentIds[1]! }),
    ).rejects.toThrow("コミットメントが見つかりません");
  });
});

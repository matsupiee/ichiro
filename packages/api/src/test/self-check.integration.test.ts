import { expect, test } from "bun:test";
import { appRouter } from "../routers/index";
import { setupDemo } from "./helpers";

test("招待APIを公開せず、一覧・詳細にもチェック者やリンクを返さない", async () => {
  for (const name of ["setChecker", "listCheckers", "getInvitation", "acceptInvitation"])
    expect(Object.keys(appRouter._def.procedures)).not.toContain(`consumer.commitment.${name}`);
  const { caller, today, seeded } = await setupDemo();
  const list = await caller.consumer.commitment.list({ today });
  const detail = await caller.consumer.commitment.get({ id: seeded.commitmentIds[0]!, today });
  for (const row of [...list, detail])
    for (const field of ["checker", "checkerUser", "checkerUserId", "shareToken"])
      expect(row).not.toHaveProperty(field);
});

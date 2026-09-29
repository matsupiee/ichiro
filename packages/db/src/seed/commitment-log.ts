import { eq } from "drizzle-orm";

import { commitment } from "../schema/commitment";
import type { SeedDatabase } from "./index";

// seedDemo の直後に使う。罰金設定を2回変更し、実際のトリガーで旧値を残す。
export async function seedCommitmentLog(
  db: SeedDatabase,
  commitmentId: string,
  paymentMethodIds: string[],
) {
  await db
    .update(commitment)
    .set({ penaltyAmount: 500, paymentMethodId: paymentMethodIds[0]! })
    .where(eq(commitment.id, commitmentId));
  await db
    .update(commitment)
    .set({ penaltyAmount: 1500, paymentMethodId: paymentMethodIds[1]! })
    .where(eq(commitment.id, commitmentId));
}

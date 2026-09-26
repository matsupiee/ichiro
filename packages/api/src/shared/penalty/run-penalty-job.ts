import type { Database } from "@ichiro/db";

import type { StripeClient } from "../../third-party-lib/stripe";
import { collectPenalties } from "./collect-penalties";
import { settleAllCommitments } from "./settle-all-commitments";

// 1時間ごとの cron から呼ぶ。締め切りを過ぎた未報告の日を精算してから、罰金を Stripe で引き落とす
export async function runPenaltyJob(db: Database, stripe: StripeClient, now: Date = new Date()) {
  const created = await settleAllCommitments(db, now);
  return { created, ...(await collectPenalties(db, stripe, now)) };
}

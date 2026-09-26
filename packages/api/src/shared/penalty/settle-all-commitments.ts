import type { Database } from "@ichiro/db";
import { commitment } from "@ichiro/db/schema/index";
import { isNull, lt, or } from "drizzle-orm";

import { settleCommitment } from "./settle-commitment";

// 精算が終わっていないコミットメントをすべて精算し、作った罰金の数を返す
export async function settleAllCommitments(db: Database, now: Date = new Date()) {
  const rows = await db
    .select()
    .from(commitment)
    .where(
      or(isNull(commitment.settledThrough), lt(commitment.settledThrough, commitment.untilDate)),
    );
  let created = 0;
  for (const row of rows) {
    created += (await settleCommitment(db, row, now)).created.length;
  }
  return created;
}

import type { commitment } from "@ichiro/db/schema/index";

import { addDays } from "../date/add-days";
import { todayIn } from "../date/today-in";

type Row = typeof commitment.$inferSelect;

// 締め切り（報告日の 23:59:59、コミットメントのタイムゾーン）を過ぎた最後の報告日の候補。
// 昨日か終了日の早いほう
export function settleableThrough(row: Pick<Row, "timeZone" | "untilDate">, now: Date): string {
  const yesterday = addDays(todayIn(row.timeZone, now), -1);
  return yesterday < row.untilDate ? yesterday : row.untilDate;
}

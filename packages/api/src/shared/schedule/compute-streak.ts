import { addDays } from "../date/add-days";
import { isScheduled, type Schedule } from "./is-scheduled";

// 予定日を今日からさかのぼり、途切れずに報告できている回数を数える。
// 今日がまだ未報告なら、今日は連続を途切れさせない（締め切り前のため）
export function computeStreak(schedule: Schedule, reported: Set<string>, today: string): number {
  let date = today;
  if (isScheduled(schedule, date) && !reported.has(date)) {
    date = addDays(date, -1);
  }
  let streak = 0;
  for (let i = 0; i < 3660 && date >= schedule.startDate; i++) {
    if (isScheduled(schedule, date)) {
      if (!reported.has(date)) break;
      streak++;
    }
    date = addDays(date, -1);
  }
  return streak;
}

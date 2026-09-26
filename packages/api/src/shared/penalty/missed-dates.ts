import { addDays } from "../date/add-days";
import { isScheduled, type Schedule } from "../schedule/is-scheduled";

// after の翌日から through までの報告日のうち、報告がなかった日
export function missedDates(
  schedule: Schedule,
  reported: Set<string>,
  after: string,
  through: string,
): string[] {
  const missed: string[] = [];
  let date = addDays(after, 1);
  if (date < schedule.startDate) date = schedule.startDate;
  for (let i = 0; i < 3660 && date <= through; i++) {
    if (isScheduled(schedule, date) && !reported.has(date)) missed.push(date);
    date = addDays(date, 1);
  }
  return missed;
}

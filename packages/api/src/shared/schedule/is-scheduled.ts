import type { CommitmentFrequency } from "@ichiro/db/schema/commitment";

// 報告日を決める、コミットメントの設定
export type Schedule = {
  frequency: CommitmentFrequency;
  weekdays: number[];
  monthDays: number[];
  startDate: string;
  untilDate: string;
};

// その日が報告日か
export function isScheduled(schedule: Schedule, date: string): boolean {
  if (date < schedule.startDate || date > schedule.untilDate) return false;
  const d = new Date(`${date}T00:00:00Z`);
  switch (schedule.frequency) {
    case "daily":
      return true;
    case "weekly":
      return schedule.weekdays.includes(d.getUTCDay());
    case "monthly":
      return schedule.monthDays.includes(d.getUTCDate());
    case "once":
      return date === schedule.untilDate;
  }
}

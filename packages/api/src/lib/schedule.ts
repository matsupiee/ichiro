import type { CommitmentFrequency } from "@ichiro/db/schema/commitment";

// 日付はすべてユーザーの現地日付を YYYY-MM-DD の文字列で扱う。
// 計算は UTC の Date で行い、タイムゾーンのずれを持ち込まない。

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type Schedule = {
  frequency: CommitmentFrequency;
  weekdays: number[];
  monthDays: number[];
  startDate: string;
  untilDate: string;
};

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function isValidDate(date: string): boolean {
  return DATE_PATTERN.test(date) && fromUtc(toUtc(date)) === date;
}

export function isScheduled(schedule: Schedule, date: string): boolean {
  if (date < schedule.startDate || date > schedule.untilDate) return false;
  const d = toUtc(date);
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

// 予定日を今日からさかのぼり、途切れずに報告できている回数を数える。
// 今日がまだ未報告なら、今日は連続を途切れさせない（締め切り前のため）。
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

// 今日を含む週（月曜はじまり）の7日分について、報告したかどうかを返す。
export function weekOf(reported: Set<string>, today: string) {
  const offset = (toUtc(today).getUTCDay() + 6) % 7;
  const monday = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, reported: reported.has(date) };
  });
}

// クライアントが送ってくる「今日」は現地日付。サーバーの UTC 日付との差が
// 1日を超えるものは受け付けない（過去日の報告を防ぐ）。
export function isPlausibleToday(today: string, now: Date = new Date()): boolean {
  if (!isValidDate(today)) return false;
  const server = fromUtc(now);
  return today >= addDays(server, -1) && today <= addDays(server, 1);
}

import { addDays } from "./add-days";
import { isValidDate } from "./is-valid-date";

// クライアントが送ってくる「今日」は現地日付。サーバーの UTC 日付との差が
// 1日を超えるものは受け付けない（過去日の報告を防ぐ）
export function isPlausibleToday(today: string, now: Date = new Date()): boolean {
  if (!isValidDate(today)) return false;
  const server = now.toISOString().slice(0, 10);
  return today >= addDays(server, -1) && today <= addDays(server, 1);
}

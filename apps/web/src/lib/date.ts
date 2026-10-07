// 日付はサーバーと同じく、現地日付の YYYY-MM-DD 文字列で扱う。

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateString(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function localToday(): string {
  return toDateString(new Date());
}

// ブラウザのタイムゾーン（IANA 名）。罰金の締め切りの判定に使う
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Tokyo";
}

export function addDays(date: string, days: number): string {
  const d = fromDateString(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// 9/1 のような短い表示
export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 2026/12/31 のような表示
export function formatFullDate(date: string): string {
  return date.replaceAll("-", "/");
}

export function formatPeriod(start: string, until: string): string {
  return `${formatMonthDay(start)}〜${formatMonthDay(until)}`;
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

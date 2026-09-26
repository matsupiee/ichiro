// 日付はすべてユーザーの現地日付を YYYY-MM-DD の文字列で扱う。
// 計算は UTC の Date で行い、タイムゾーンのずれを持ち込まない
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

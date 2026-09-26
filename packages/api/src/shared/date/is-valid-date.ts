const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// YYYY-MM-DD の形で、実在する日付か
export function isValidDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toISOString().slice(0, 10) === date;
}

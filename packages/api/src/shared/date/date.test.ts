import { describe, expect, test } from "bun:test";

import { addDays } from "./add-days";
import { isPlausibleToday } from "./is-plausible-today";
import { isValidDate } from "./is-valid-date";
import { isValidTimeZone } from "./is-valid-time-zone";
import { todayIn } from "./today-in";

describe("addDays", () => {
  test("月や年をまたいで日付を進め、戻せる", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("isValidDate", () => {
  test("存在しない日付は受け付けない", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-9-1")).toBe(false);
    expect(isValidDate("2026-09-01")).toBe(true);
  });
});

describe("isPlausibleToday", () => {
  test("サーバーの日付から1日を超えてずれた今日は受け付けない", () => {
    const now = new Date("2026-09-26T15:30:00Z"); // 日本時間では 9/27
    expect(isPlausibleToday("2026-09-27", now)).toBe(true);
    expect(isPlausibleToday("2026-09-25", now)).toBe(true);
    expect(isPlausibleToday("2026-09-24", now)).toBe(false);
  });
});

describe("todayIn", () => {
  test("タイムゾーンごとの今日の日付を返す", () => {
    const now = new Date("2026-09-26T15:30:00Z");
    expect(todayIn("UTC", now)).toBe("2026-09-26");
    expect(todayIn("Asia/Tokyo", now)).toBe("2026-09-27");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-09-26");
  });
});

describe("isValidTimeZone", () => {
  test("IANA のタイムゾーン名だけを受け付ける", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

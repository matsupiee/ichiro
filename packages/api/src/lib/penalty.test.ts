import { describe, expect, test } from "bun:test";

import { isValidTimeZone, missedDates, settleableThrough, todayIn } from "./penalty";
import type { Schedule } from "./schedule";

const base: Schedule = {
  frequency: "daily",
  weekdays: [],
  monthDays: [],
  startDate: "2026-09-01",
  untilDate: "2026-12-31",
};

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

describe("settleableThrough", () => {
  test("締め切りを過ぎたのは昨日まで。日付が変わった直後から前日が対象になる", () => {
    const row = { timeZone: "Asia/Tokyo", untilDate: "2026-12-31" };
    // 日本時間 9/26 23:59 はまだ 9/26 の締め切り前
    expect(settleableThrough(row, new Date("2026-09-26T14:59:00Z"))).toBe("2026-09-25");
    // 日本時間 9/27 0:00 を過ぎると 9/26 が締め切りを過ぎる
    expect(settleableThrough(row, new Date("2026-09-26T15:00:00Z"))).toBe("2026-09-26");
  });

  test("終了日より先は対象にしない", () => {
    const row = { timeZone: "UTC", untilDate: "2026-09-10" };
    expect(settleableThrough(row, new Date("2026-09-26T12:00:00Z"))).toBe("2026-09-10");
  });
});

describe("missedDates", () => {
  test("報告日のうち、報告がなかった日だけを返す", () => {
    const reported = new Set(["2026-09-02", "2026-09-04"]);
    expect(missedDates(base, reported, "2026-09-01", "2026-09-05")).toEqual([
      "2026-09-03",
      "2026-09-05",
    ]);
  });

  test("報告日でない曜日は罰金の対象にならない", () => {
    // 2026-09-07 は月曜
    const s: Schedule = { ...base, frequency: "weekly", weekdays: [1, 3] };
    expect(missedDates(s, new Set(["2026-09-07"]), "2026-09-06", "2026-09-13")).toEqual([
      "2026-09-09",
    ]);
  });

  test("開始日より前と、精算ずみの日は数えない", () => {
    const s: Schedule = { ...base, startDate: "2026-09-10" };
    expect(missedDates(s, new Set(), "2026-09-01", "2026-09-11")).toEqual([
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(missedDates(s, new Set(), "2026-09-11", "2026-09-11")).toEqual([]);
  });

  test("1回だけなら実施日だけが対象", () => {
    const s: Schedule = { ...base, frequency: "once", untilDate: "2026-09-20" };
    expect(missedDates(s, new Set(), "2026-09-01", "2026-09-20")).toEqual(["2026-09-20"]);
  });
});

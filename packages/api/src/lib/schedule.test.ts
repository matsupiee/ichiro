import { describe, expect, test } from "bun:test";

import {
  addDays,
  computeStreak,
  isPlausibleToday,
  isScheduled,
  isValidDate,
  type Schedule,
  weekOf,
} from "./schedule";

const base: Schedule = {
  frequency: "daily",
  weekdays: [],
  monthDays: [],
  startDate: "2026-09-01",
  untilDate: "2026-12-31",
};

describe("isScheduled", () => {
  test("毎日なら期間内のすべての日が予定日になる", () => {
    expect(isScheduled(base, "2026-09-01")).toBe(true);
    expect(isScheduled(base, "2026-12-31")).toBe(true);
    expect(isScheduled(base, "2026-08-31")).toBe(false);
    expect(isScheduled(base, "2027-01-01")).toBe(false);
  });

  test("曜日ごとなら選んだ曜日だけが予定日になる", () => {
    const s: Schedule = { ...base, frequency: "weekly", weekdays: [1, 3, 5] };
    expect(isScheduled(s, "2026-09-28")).toBe(true); // 月
    expect(isScheduled(s, "2026-09-29")).toBe(false); // 火
    expect(isScheduled(s, "2026-09-27")).toBe(false); // 日
  });

  test("月の特定の日なら選んだ日付だけが予定日になる", () => {
    const s: Schedule = { ...base, frequency: "monthly", monthDays: [1, 15] };
    expect(isScheduled(s, "2026-10-15")).toBe(true);
    expect(isScheduled(s, "2026-10-16")).toBe(false);
  });

  test("1回だけなら実施日だけが予定日になる", () => {
    const s: Schedule = { ...base, frequency: "once", untilDate: "2026-10-10" };
    expect(isScheduled(s, "2026-10-10")).toBe(true);
    expect(isScheduled(s, "2026-10-09")).toBe(false);
  });
});

describe("computeStreak", () => {
  const days = (from: string, n: number) =>
    new Set(Array.from({ length: n }, (_, i) => addDays(from, i)));

  test("今日が未報告でも昨日までの連続は途切れない", () => {
    expect(computeStreak(base, days("2026-09-19", 7), "2026-09-26")).toBe(7);
  });

  test("今日も報告すると連続に含まれる", () => {
    expect(computeStreak(base, days("2026-09-19", 8), "2026-09-26")).toBe(8);
  });

  test("昨日が抜けていると連続は0に戻る", () => {
    expect(computeStreak(base, days("2026-09-10", 5), "2026-09-26")).toBe(0);
  });

  test("曜日ごとの場合は予定のない日を飛ばして数える", () => {
    const s: Schedule = { ...base, frequency: "weekly", weekdays: [1, 3, 5] };
    // 9/21 月, 9/23 水, 9/25 金
    const reported = new Set(["2026-09-21", "2026-09-23", "2026-09-25"]);
    expect(computeStreak(s, reported, "2026-09-26")).toBe(3);
  });

  test("開始日より前はさかのぼらない", () => {
    const s = { ...base, startDate: "2026-09-24" };
    expect(computeStreak(s, days("2026-09-20", 7), "2026-09-26")).toBe(3);
  });
});

describe("weekOf", () => {
  test("月曜はじまりの7日分を返す", () => {
    const week = weekOf(new Set(["2026-09-21", "2026-09-26"]), "2026-09-26");
    expect(week.map((d) => d.date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(week.map((d) => d.reported)).toEqual([true, false, false, false, false, true, false]);
  });
});

describe("日付の検証", () => {
  test("存在しない日付は受け付けない", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-9-1")).toBe(false);
    expect(isValidDate("2026-09-01")).toBe(true);
  });

  test("サーバーの日付から1日を超えてずれた今日は受け付けない", () => {
    const now = new Date("2026-09-26T15:30:00Z"); // 日本時間では 9/27
    expect(isPlausibleToday("2026-09-27", now)).toBe(true);
    expect(isPlausibleToday("2026-09-25", now)).toBe(true);
    expect(isPlausibleToday("2026-09-24", now)).toBe(false);
  });
});

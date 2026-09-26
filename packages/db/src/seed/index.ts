import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

import { account, user } from "../schema/auth";
import { commitment } from "../schema/commitment";
import { penalty } from "../schema/penalty";
import { report } from "../schema/report";

// D1・libsql・テスト用 DB のどれにも流せるよう、非同期 SQLite の共通型で受ける。
// oxlint-disable-next-line typescript/no-explicit-any
export type SeedDatabase = SQLiteAsyncDatabase<"async", any, any>;

export const DEMO_USER = {
  name: "hiromu",
  email: "demo@ichiro.app",
  password: "password123",
} as const;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function localToday(now: Date = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// デモユーザーと、メインページに並ぶ3件のコミットメントを作る。
// 何度実行しても同じ状態になるよう、既存のデモユーザーは消してから作り直す。
// 罰金は昨日の分まで精算ずみにする。timeZone は today と同じ日付になるものを渡す。
export async function seedDemo(
  db: SeedDatabase,
  today: string = localToday(),
  timeZone: string = localTimeZone(),
) {
  await db.delete(user).where(eq(user.email, DEMO_USER.email));
  const settled = { timeZone, settledThrough: addDays(today, -1) };

  const userId = createId();
  await db.insert(user).values({
    id: userId,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    emailVerified: true,
    updatedAt: new Date(),
  });
  await db.insert(account).values({
    id: createId(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(DEMO_USER.password),
    updatedAt: new Date(),
  });

  // 一覧は新しい順に並ぶので、デザインと同じ並び（広東語→体づくり→禁煙）になるよう逆順に作る
  // 1. 毎日。今日まで42日連続で達成ずみ
  const [smoking] = await db
    .insert(commitment)
    .values({
      userId,
      goal: "禁煙",
      content: "禁煙する",
      frequency: "daily",
      weekdays: [1],
      monthDays: [1],
      startDate: addDays(today, -41),
      untilDate: addDays(today, 186),
      penaltyAmount: 3000,
      paymentMethod: "apple_pay",
      checker: "friend",
      friendEmail: "mom@example.com",
      ...settled,
    })
    .returning();

  // 2. 曜日ごと（月水金）。友達がチェックする
  const [gym] = await db
    .insert(commitment)
    .values({
      userId,
      goal: "体づくり",
      content: "週3でジムに行って、筋トレ45分と有酸素運動20分をやる",
      frequency: "weekly",
      weekdays: [1, 3, 5],
      monthDays: [1],
      startDate: addDays(today, -19),
      untilDate: addDays(today, 65),
      penaltyAmount: 1000,
      paymentMethod: "card",
      checker: "friend",
      friendEmail: "matsukiyo@example.com",
      ...settled,
    })
    .returning();

  // 3. 毎日。昨日まで7日連続で達成、今日はまだ報告していない。
  //    8日前と15日前は報告できず、罰金を500円ずつ徴収ずみ
  const [cantonese] = await db
    .insert(commitment)
    .values({
      userId,
      goal: "広東語マスター",
      content: "毎日30分広東語を練習する",
      frequency: "daily",
      weekdays: [1, 3, 5],
      monthDays: [1],
      startDate: addDays(today, -25),
      untilDate: addDays(today, 96),
      penaltyAmount: 500,
      paymentMethod: "apple_pay",
      checker: "self",
      friendEmail: null,
      ...settled,
    })
    .returning();

  const gymDays = range(-19, -1)
    .map((d) => addDays(today, d))
    .filter((d) => [1, 3, 5].includes(new Date(`${d}T00:00:00Z`).getUTCDay()));

  const reports = [
    ...range(-25, -1)
      .filter((d) => d !== -8 && d !== -15)
      .map((d) => ({ commitmentId: cantonese!.id, reportDate: addDays(today, d) })),
    ...gymDays.map((d) => ({ commitmentId: gym!.id, reportDate: d })),
    ...range(-41, 0).map((d) => ({ commitmentId: smoking!.id, reportDate: addDays(today, d) })),
  ];
  // D1 は1文あたりのパラメータ数に上限があるので小分けに入れる
  for (let i = 0; i < reports.length; i += 20) {
    await db.insert(report).values(reports.slice(i, i + 20));
  }

  await db.insert(penalty).values(
    [-15, -8].map((d) => ({
      userId,
      commitmentId: cantonese!.id,
      dueDate: addDays(today, d),
      amount: 500,
      paymentMethod: "apple_pay" as const,
      status: "paid" as const,
      attempts: 1,
      chargeReference: `seed_${d}`,
      paidAt: new Date(`${addDays(today, d + 1)}T01:05:00Z`),
    })),
  );

  return { userId, commitmentIds: [cantonese!.id, gym!.id, smoking!.id] };
}

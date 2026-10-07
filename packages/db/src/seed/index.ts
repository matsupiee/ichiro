import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

import { account, user } from "../schema/auth";
import { commitment } from "../schema/commitment";
import { paymentCustomer } from "../schema/payment-customer";
import { paymentMethod } from "../schema/payment-method";
import { penalty } from "../schema/penalty";
import { report } from "../schema/report";

// D1・libsql・テスト用 DB のどれにも流せるよう、非同期 SQLite の共通型で受ける。
// oxlint-disable-next-line typescript/no-explicit-any
export type SeedDatabase = SQLiteAsyncDatabase<"async", any, any>;

export const DEMO_USER = {
  name: "taro",
  email: "demo@ichiro.app",
  password: "password123",
} as const;

async function createUser(
  db: SeedDatabase,
  u: { name: string; email: string; password: string },
): Promise<string> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, u.email));
  if (existing) {
    // 罰金は本来削除を制限しているため、デモの作り直し時だけ先に削除する
    await db.delete(penalty).where(eq(penalty.userId, existing.id));
    await db.delete(commitment).where(eq(commitment.userId, existing.id));
  }
  await db.delete(user).where(eq(user.email, u.email));
  const userId = createId();
  await db.insert(user).values({
    id: userId,
    name: u.name,
    email: u.email,
    emailVerified: true,
    updatedAt: new Date(),
  });
  await db.insert(account).values({
    id: createId(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(u.password),
    updatedAt: new Date(),
  });
  return userId;
}

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
// stripe を渡すと、1つめの支払い方法をその Stripe テスト環境の Customer・PaymentMethod にする。
export async function seedDemo(
  db: SeedDatabase,
  today: string = localToday(),
  timeZone: string = localTimeZone(),
  stripe?: { customerId: string; paymentMethodId: string },
) {
  const userId = await createUser(db, DEMO_USER);
  const settled = { timeZone, settledThrough: addDays(today, -1) };

  // Stripe に登録ずみの支払い方法のつもりのデータ。stripe を渡さないときの ID は Stripe に
  // 実在しないので、引き落とそうとすると失敗する
  await db
    .insert(paymentCustomer)
    .values({ userId, stripeCustomerId: stripe?.customerId ?? `cus_demo_${userId}` });
  const [visa] = await db
    .insert(paymentMethod)
    .values({
      userId,
      stripePaymentMethodId: stripe?.paymentMethodId ?? `pm_demo_visa_${userId}`,
      brand: "visa",
      last4: "4242",
      wallet: null,
    })
    .returning();
  const [card] = await db
    .insert(paymentMethod)
    .values({
      userId,
      stripePaymentMethodId: `pm_demo_card_${userId}`,
      brand: "mastercard",
      last4: "4444",
      wallet: null,
    })
    .returning();

  // 一覧は新しい順に並ぶので、デザインと同じ並び（広東語→体づくり→禁煙）になるよう逆順に作る
  // 1. 毎日。今日まで42日連続で達成ずみ
  const [smoking] = await db
    .insert(commitment)
    .values({
      userId,
      content: "禁煙する",
      frequency: "daily",
      weekdays: [1],
      monthDays: [1],
      startDate: addDays(today, -41),
      untilDate: addDays(today, 186),
      penaltyAmount: 3000,
      paymentMethodId: visa!.id,
      ...settled,
    })
    .returning();

  // 2. 曜日ごと（月水金）。自分で達成を報告する
  const [gym] = await db
    .insert(commitment)
    .values({
      userId,
      content: "週3でジムに行って、筋トレ45分と有酸素運動20分をやる",
      frequency: "weekly",
      weekdays: [1, 3, 5],
      monthDays: [1],
      startDate: addDays(today, -19),
      untilDate: addDays(today, 65),
      penaltyAmount: 1000,
      paymentMethodId: card!.id,
      ...settled,
    })
    .returning();

  // 3. 毎日。昨日まで7日連続で達成、今日はまだ報告していない。
  //    8日前と15日前は報告できず、罰金を500円ずつ徴収ずみ
  const [cantonese] = await db
    .insert(commitment)
    .values({
      userId,
      content: "毎日30分広東語を練習する",
      frequency: "daily",
      weekdays: [1, 3, 5],
      monthDays: [1],
      startDate: addDays(today, -25),
      untilDate: addDays(today, 96),
      penaltyAmount: 500,
      paymentMethodId: visa!.id,
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
      paymentMethodId: visa!.id,
      status: "paid" as const,
      attempts: 1,
      chargeReference: `seed_${d}`,
      paidAt: new Date(`${addDays(today, d + 1)}T01:05:00Z`),
    })),
  );

  return {
    userId,
    commitmentIds: [cantonese!.id, gym!.id, smoking!.id],
    paymentMethodIds: [visa!.id, card!.id],
  };
}

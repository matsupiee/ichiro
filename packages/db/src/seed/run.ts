// デモデータを投入するコマンド。
//
//   bun run db:seed -- --url file:./local.db   libsql / SQLite ファイルに投入（マイグレーションも適用）
//   bun run db:seed                            Cloudflare D1 に HTTP 経由で投入
//
// D1 に投入するときは CLOUDFLARE_ACCOUNT_ID・CLOUDFLARE_DATABASE_ID・CLOUDFLARE_D1_TOKEN が必要。
// --today YYYY-MM-DD で「今日」を固定できる（省略時はこのマシンの現地日付）。
// 昨日の日付を渡すと、昨日の分が未精算のまま残るので、罰金が発生するところを確かめられる。
// コミットメントのタイムゾーンはこのマシンのもの（TZ で変えられる）。
// --stripe-customer cus_... --stripe-payment-method pm_... を渡すと、デモの1つめの支払い方法
// （「禁煙」「広東語マスター」の引き落とし先）を Stripe のテスト環境に実在するものにする。
// 例: stripe customers create → stripe payment_methods attach pm_card_visa --customer <cus_...>
import { parseArgs } from "node:util";

import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";

import { DEMO_USER, FRIEND_USER, localToday, seedDemo, type SeedDatabase } from "./index";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    today: { type: "string" },
    "stripe-customer": { type: "string" },
    "stripe-payment-method": { type: "string" },
  },
});

async function libsqlDb(url: string): Promise<SeedDatabase> {
  const db = drizzleLibsql({ client: createClient({ url }) });
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  return db;
}

function d1HttpDb(): SeedDatabase {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN } = process.env;
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID || !CLOUDFLARE_D1_TOKEN) {
    throw new Error(
      "--url を指定するか、CLOUDFLARE_ACCOUNT_ID・CLOUDFLARE_DATABASE_ID・CLOUDFLARE_D1_TOKEN を設定してください",
    );
  }
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/raw`;
  return drizzleProxy(async (sql, params, method) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_D1_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });
    const body = (await res.json()) as {
      success: boolean;
      errors: { message: string }[];
      result: { results: { rows: unknown[][] } }[];
    };
    if (!body.success) {
      throw new Error(body.errors.map((e) => e.message).join("\n"));
    }
    const rows = body.result[0]?.results.rows ?? [];
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  });
}

const db = values.url ? await libsqlDb(values.url) : d1HttpDb();
const today = values.today ?? localToday();
const customerId = values["stripe-customer"];
const paymentMethodId = values["stripe-payment-method"];
if (!customerId !== !paymentMethodId) {
  throw new Error("--stripe-customer と --stripe-payment-method は両方指定してください");
}
await seedDemo(
  db,
  today,
  undefined,
  customerId && paymentMethodId ? { customerId, paymentMethodId } : undefined,
);

console.log(`デモデータを投入しました（今日 = ${today}）`);
console.log(`  メールアドレス: ${DEMO_USER.email}`);
console.log(`  パスワード:     ${DEMO_USER.password}`);
console.log(`  友達（登録ずみ）: ${FRIEND_USER.email} / ${FRIEND_USER.password}`);

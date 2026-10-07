// ローカル専用。ブラウザの E2E テスト（apps/web/e2e）の前に、ローカル D1 を決まった状態にする。
//
//   bun run db:seed:e2e                      開発サーバーのローカル D1 を自動で探して投入する
//   bun run db:seed:e2e -- --url file:/...   投入先を指定する
//
// デモユーザー（commitment-list などのストーリー用）とパスワード再設定・登録済みアドレスの確認用ユーザーを
// 作り直し、認証の回数制限の記録を消す。テストを続けて実行しても 429 にならないようにするため。
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { rateLimit } from "../schema/auth";
import { seedEmailVerification } from "./email-verification";
import { DEMO_USER, localTimeZone, localToday, seedDemo } from "./index";
import { seedPasswordReset } from "./password-reset";

const { values } = parseArgs({ options: { url: { type: "string" } } });

// db:studio（drizzle.local.config.ts）と同じ方法で、Alchemy の開発サーバーが使うローカル D1 を探す
function localD1Url() {
  const directory = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
    "../infra/.alchemy/local/d1",
  );
  const candidates = existsSync(directory)
    ? readdirSync(directory, { recursive: true, encoding: "utf8" })
        .filter((path) => path.endsWith(".sqlite") && basename(path) !== "metadata.sqlite")
        .map((path) => resolve(directory, path))
        .filter((path) => statSync(path).isFile())
    : [];
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length === 0
        ? "ローカル D1 が見つかりません。先にルートで bun run dev:server を起動してください。"
        : `ローカル D1 が複数あります。--url で指定してください。\n${candidates.join("\n")}`,
    );
  }
  return `file:${candidates[0]}`;
}

// Alchemy が移行済みのローカル D1 に入れるので、マイグレーションは適用しない
const db = drizzle({ client: createClient({ url: values.url ?? localD1Url() }) });
const today = localToday();
await seedDemo(db, today, localTimeZone());
await seedPasswordReset(db);
await seedEmailVerification(db, true);
await db.delete(rateLimit);

console.log(`E2E 用のデータを投入しました（今日 = ${today}、${DEMO_USER.email}）`);

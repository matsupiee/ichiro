# Database Patterns

## テーブルの先頭には id・createdAt・updatedAt を書く (CRITICAL)

どのテーブルも、カラム定義の先頭3つを次の形にする。`createdAt` と `updatedAt` はすべてのテーブルに必要。

```ts
import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ✅ CORRECT: id・createdAt・updatedAt を先頭に並べる
export const report = sqliteTable("report", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
  commitmentId: text("commitment_id").notNull(),
  // ...
});

// ❌ WRONG: updatedAt がない。createdAt が末尾に埋もれている
export const report_bad = sqliteTable("report", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  commitmentId: text("commitment_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
```

- 日時は `integer` の `timestamp_ms` モードでミリ秒として持つ。
- `createdAt` と `updatedAt` の初期値は DB 側の `default` で入れる。アプリから渡さなくても値が入る。
- `updatedAt` は `$onUpdate` で、Drizzle から update するたびに現在時刻へ更新される。
- 更新されないテーブル（報告や招待の履歴など）でも `updatedAt` は置く。あとから更新が必要になったときにマイグレーションで足さずに済む。
- 既存のテーブルに `updatedAt` を足すときは、`drizzle-kit generate` を2回に分ける。SQLite は式のデフォルト値を持つ列を、行のあるテーブルへ `ALTER TABLE ADD` で足せない（`Cannot add a column with non-constant default` になる）。
  - 1回目はデフォルトを `sql\`0\`` にして生成する。列が定数デフォルトで足される。
  - 2回目は上の形に戻して生成する。drizzle-kit がテーブルを作り直すマイグレーションを出す。
  - 作り直しでは既存行の `updated_at` は 0 のまま残る。
  - 作り直すテーブルがほかのテーブルから外部キーで参照されていると、D1 では DROP のときに参照側へ `ON DELETE` の動作が走る恐れがある。本番データがあるときは事前に確かめる。
- better-auth が管理するテーブル（`schema/auth.ts`）は例外。id は better-auth が作るので `$defaultFn` を付けず、並びも better-auth の生成したものに合わせる。

## DB Insert: id・createdAt・updatedAt を省略する (CRITICAL)

Drizzle ORM でレコードを insert する際は、`id`・`createdAt`・`updatedAt` を必ず省略する。

これらはスキーマで自動生成されるため、明示的に渡してはならない。

```ts
// ✅ CORRECT: id・createdAt・updatedAt を省略
await db.insert(report).values({
  commitmentId,
  reportDate: "2026-09-26",
});

// ❌ WRONG: id や createdAt を明示的に渡さない
await db.insert(report).values({
  id: createId(), // ← NG: スキーマの $defaultFn が処理する
  createdAt: new Date(), // ← NG: スキーマの default が処理する
  updatedAt: new Date(), // ← NG: スキーマの default が処理する
  commitmentId,
  reportDate: "2026-09-26",
});
```

## id の生成には @paralleldrive/cuid2 を使用する

`id` は `@paralleldrive/cuid2` の `createId` で作る（書き方は上の「テーブルの先頭には id・createdAt・updatedAt を書く」を参照）。

- `uuid()` や `nanoid()` は使わず、必ず `createId()` を使う
- insert 時に `id` を手動で渡すのは禁止（スキーマの `$defaultFn` に任せる）

## 値が固定・変動しにくいカラムには enum を使う

取りうる値が確定していて変動が少ない場合は、`text` ではなく Drizzle の `pgEnum` を使ってスキーマレベルで制約する。

```ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ✅ CORRECT: 値が固定のカラムは enum で定義
export const scraperSourceEnum = pgEnum("scraper_source", ["ndl", "kagoshima", "local"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed"]);

export const scraper_jobs = pgTable("scraper_jobs", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  source: scraperSourceEnum("source").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ❌ WRONG: 固定値なのに text で定義すると不正な値を防げない
export const scraper_jobs_bad = pgTable("scraper_jobs", {
  source: text("source").notNull(), // ← "ndl" 以外も入れられてしまう
  status: text("status").notNull(),
});
```

- enum を使うことで DB レベルで不正な値を防止できる
- TypeScript 型も自動で絞り込まれるため、アプリ側のバリデーションが容易になる
- 値の追加が頻繁に発生するカラムはマイグレーションコストが高まるため、その場合は `text` でも可

## マイグレーションファイルは手書き禁止 (CRITICAL)

マイグレーションファイル（`packages/db/src/migrations/*.sql`）は必ず `drizzle-kit generate` で生成する。手書きは絶対にしない。

```bash
# ✅ CORRECT: drizzle-kit で生成する
npx drizzle-kit generate

# ❌ WRONG: SQL ファイルを直接編集・手書きする
# Write/Edit ツールで .sql ファイルを作成・編集してはいけない
```

- `drizzle-kit generate --custom` も手書き前提なので使用禁止
- スキーマ変更後は必ず `drizzle-kit generate` を実行してマイグレーションを生成する
- インタラクティブな質問がある場合はユーザーに確認を求める

## 1 テーブル　1ファイルにする。

1つのファイルに複数のテーブルを詰め込まないこと。

# ichiro

続けたいことを宣言して、毎日の達成を報告する Web アプリ。報告できなかった日には、任意で設定した罰金を Stripe で徴収する。

画面と API は1つの Cloudflare Worker から同じオリジンで配信する。

- `apps/web`: TanStack Start。画面（`/app`）、紹介ページと規約（`/`、`/terms` など）、API（`/api/*`）、罰金精算の cron
- `packages/api`: tRPC のルーターとビジネスロジック
- `packages/auth`: Better Auth の設定（メールアドレスとパスワード、メールの確認コード）
- `packages/db`: Drizzle のスキーマ、マイグレーション、デモデータ（seed）
- `packages/infra`: Alchemy による Cloudflare の構成（Worker、D1、R2）

移行の経緯と設計の判断は [Web 版への移行計画](docs/development/web-migration-plan.md) にまとめている。

## はじめに

```bash
bun install
```

`apps/web/.env` に開発用の環境変数を設定する。項目と説明は `apps/web/.env.schema` にある。
認証メールを実際に送らずに確認する場合は `AUTH_EMAIL_DELIVERY=console` にする（[認証メール](docs/development/auth-email.md)）。

```bash
bun run dev
```

`http://localhost:3000` で紹介ページ、`http://localhost:3000/app` でアプリが開く。
`alchemy dev` は D1 のマイグレーションを適用し、ローカルの D1・R2 で動く。
初回は `packages/infra` で `bunx alchemy profile edit --add Cloudflare` を実行する。Cloudflare の認証情報を置けない環境での起動方法は [移行計画の「ローカルでの起動」](docs/development/web-migration-plan.md#ローカルでの起動) を参照する。

デモデータは `bun run db:seed -- --url file:/絶対パス/対象.sqlite --skip-migrations` で作る。ローカル D1 のパスは [ローカル D1 の確認](docs/development/local-d1-studio.md) を参照する。

## 主なコマンド

- `bun run dev`: 開発サーバー（画面と API）
- `bun run dev:stripe`: 開発サーバーと Stripe の Webhook の転送（[手順](docs/development/local-stripe-webhook.md)）
- `bun run check-types`: 型チェック
- `bun run test`: テスト（API、Web、インフラ）
- `bun run test:e2e`: ブラウザでユーザーストーリーを通しで確認する E2E テスト（[手順](docs/development/e2e.md)）
- `bun run check`: Oxlint と Oxfmt
- `bun run db:generate`: マイグレーションの生成
- `bun run db:studio`: ローカル D1 を Drizzle Studio で開く

## デプロイ

stg と prod を明示してデプロイする。設定は [Cloudflare の環境設定](docs/development/cloudflare-environments.md) を参照する。

```bash
bun run deploy:check:stg
bun run deploy:stg
bun run deploy:check:prod
bun run deploy:prod
```

`main` への push で GitHub Actions が stg にデプロイする。

## 環境変数

各アプリの `.env.schema` に定義し、Varlock が `src/env.ts` を生成する。スキーマを変えたら `bun run env:generate` を実行する。
秘密情報は Git に入れず、`.env.*.local` か CI の環境変数に置く。Worker のコードは Cloudflare のバインディング（`cloudflare:workers` の `env`）から読む。

## ドキュメント

- `docs/user-stories/`: ユーザーストーリーと動作確認の手順
- `docs/development/`: 開発・検証の手順
- `docs/rules/`: 実装とドキュメントのルール

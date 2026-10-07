# stg / prod へのデプロイ

## 構成

Alchemy の stage を `stg` と `prod` に固定する。同じ Cloudflare アカウントでも Worker・D1・R2 は stage ごとに作られる。リソース名を共通の固定名に変えない。Alchemy の状態ストアはアカウント内で共有し、スタックの状態を stage ごとに管理する。

Worker は `packages/infra/alchemy.run.ts` の `Cloudflare.Website.Vite` で `apps/web`（TanStack Start）からビルドする。サーバー側のバンドルが Worker になり、クライアント側のファイルと `apps/web/public/` は Static Assets になる。画面と API は同じ Worker から同一オリジンで配信する。Worker のエントリは `apps/web/src/server.ts` で、`fetch` を TanStack Start に、毎時5分の cron（`scheduled`）を罰金の精算と徴収に割り当てる。

Varlock の `APP_ENV` で設定ファイルを選ぶ。サーバーの `NODE_ENV` は stg / prod ともに `production`。開発は `APP_ENV=development` のまま使える。

`apps/web/.env.stg` と `.env.prod` は秘密情報を空文字で上書きする公開テンプレート。開発用 `.env` の値を暗黙に使わないために置く。値は Git 管理外の `.env.stg.local` / `.env.prod.local` または CI の環境変数に設定する。

## 初回の準備

1. リポジトリのルートで `bun run cloudflare:login` を実行し、ブラウザで対象の Cloudflare アカウントを認可する。
   - ログイン専用のエントリ `packages/infra/alchemy.profile.ts` を使うので、開発用の `apps/web/.env` が無くても実行できる。
   - `alchemy.run.ts` は読み込み時に Varlock で開発用の環境変数を検証するため、`bunx alchemy profile edit` を直接実行すると `.env` が無いときに止まる。
2. `apps/web/.env.stg.local` と `.env.prod.local` に次の値を設定する。

| 変数                     | stg                              | prod                           |
| ------------------------ | -------------------------------- | ------------------------------ |
| `BETTER_AUTH_SECRET`     | stg 専用の32文字以上のランダム値 | prod 専用の別の値              |
| `STRIPE_SECRET_KEY`      | `sk_test_...`                    | `sk_live_...`                  |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...`                    | `pk_live_...`                  |
| `STRIPE_WEBHOOK_SECRET`  | stg の Webhook の `whsec_...`    | prod の Webhook の `whsec_...` |

`STRIPE_PUBLISHABLE_KEY` はブラウザの Payment Element で支払い方法を登録するときに使う公開可能キー。ビルドには埋め込まず、Worker の環境変数からサーバーが画面へ渡す。`STRIPE_SECRET_KEY` と同じ Stripe アカウントのキーにする。

`RESEND_API_KEY` も各環境に設定する。認証メールは `ichiro <noreply@mail.ichiro.app>` から Resend で送る。詳細は [認証メール](./auth-email.md)。

`BETTER_AUTH_URL` は Alchemy が Worker の URL を設定するので指定不要。画面と API は同じ Worker から同一オリジンで配信するため、認証が信頼するオリジンはこの URL だけになる。`CORS_ORIGIN` は廃止したので設定しない。

Stripe の Webhook は `<Worker の URL>/api/stripe/webhook` に作成する。イベントは `setup_intent.succeeded`、`payment_intent.succeeded`、`payment_intent.payment_failed`・`payment_intent.requires_action`。stg と prod で別エンドポイント・署名シークレットにする。

初回に Worker URL がまだ不明なら、任意のランダムな `whsec_...` を一時設定してデプロイする。出力された URL で Stripe の Webhook を作り、実際の署名シークレットへ置き換えて再デプロイする。一時設定の間は署名検証に失敗するため、ユーザーの利用・支払い登録・seed 投入は再デプロイ後に行う。

## 実行

リポジトリのルートで実行する。

```bash
bun run deploy:check:stg
bun run deploy:stg

bun run deploy:check:prod
bun run deploy:prod
```

デプロイが `Cloudflare OAuth refresh failed` で止まったら、ログインの期限が切れている。`bun run cloudflare:refresh` で更新する。更新できないときは `bun run cloudflare:login` でログインし直す。

`--check` は設定検証だけで、Cloudflare に接続しない。`bun run deploy:stg --dry-run` は Alchemy の変更計画を確認する。Alchemy の状態ストアの初期化が必要になる場合があるため、完全なオフライン検証ではない。

コマンドが `APP_ENV`・`ALCHEMY_STAGE`・`NODE_ENV` を揃えて渡す。外部から異なる stage が指定されていたら停止する。Alchemy を直接実行した場合も、スタック側で stage と設定を検証する。stg に本番 Stripe キー、prod にテストキーを渡すと停止する。`STRIPE_SECRET_KEY` は stg が `sk_test_`、prod が `sk_live_`、`STRIPE_PUBLISHABLE_KEY` は stg が `pk_test_`、prod が `pk_live_` で始まることを確かめる（`packages/infra/scripts/deployment-settings.ts`）。

D1 のマイグレーションは `packages/db/src/migrations` からデプロイ時に適用する。stg で確認したコミットを prod にデプロイする。既存データと旧バージョンの Worker が読める変更にし、Worker の巻き戻しで DB の変更まで戻るとは考えない。

## ドメイン

prod は `https://ichiro.app` で配信する。`packages/infra/alchemy.run.ts` の `domain` を prod にだけ設定し、Alchemy が Custom Domain を管理する。Cloudflare の同じアカウントに Active な `ichiro.app` のゾーンが必要。`BETTER_AUTH_URL` は `Cloudflare.Worker.URL` から独自ドメインの URL に解決される。stg は Alchemy が出力する Worker の URL を使う。

画面も同じ Worker から配信するので、接続先を切り替える設定はない。stg のアプリは stg の Worker の URL、prod のアプリは https://ichiro.app をブラウザで開く。紹介ページは `/`、アプリは `/app`。

## 確認

- Worker の `/` がログインなしでサービス紹介の HTML を返し、`/app` がはじめにの画面（`/app/welcome`）へ移ることをブラウザで確認する。
- Cloudflare 上で Worker・D1・R2 が stg / prod で別リソースになっていることを確認する。
- stg の Worker の URL をブラウザで開き、新規登録・ログイン・画像アップロード・支払い登録を行う。支払い登録で Payment Element が表示されることで、公開可能キーが渡っていることも確かめる。
- prod に stg のユーザー・画像・支払い情報が存在しないことを確認する。
- stg の Stripe テスト環境で Webhook と毎時5分の徴収ジョブを確認する。
- 全ストーリーの回帰テストは `bun run test`、画面の確認はローカルの [E2E テスト](./e2e.md)（`bun run test:e2e`）とブラウザで行う。

データ作成には既存の `packages/db/src/seed/run.ts` を使う。ローカル検証は `bun run db:seed -- --url file:/tmp/ichiro-stg-qa.db`。stg の D1 に投入するときはその DB の `CLOUDFLARE_DATABASE_ID` と `CLOUDFLARE_ACCOUNT_ID`・`CLOUDFLARE_D1_TOKEN` を指定し、`packages/db` から `bun run src/seed/run.ts` を実行する。デモ seed は既存のデモユーザーを作り直すため、prod には投入しない。

## 参考

- [Alchemy deploy](https://alchemy.run/cli/deploy/)
- [Varlock の環境分離](https://varlock.dev/guides/environments/)
- [Varlock のモノレポ設定](https://varlock.dev/guides/monorepos/)

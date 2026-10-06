# Cloudflare の stg / prod デプロイ

## 構成

Alchemy の stage を `stg` と `prod` に固定する。同じ Cloudflare アカウントでも Worker・D1・R2 は stage ごとに作られる。リソース名を共通の固定名に変えない。Alchemy の状態ストアはアカウント内で共有し、スタックの状態を stage ごとに管理する。

Varlock の `APP_ENV` で設定ファイルを選ぶ。サーバーの `NODE_ENV` は stg / prod ともに `production`。開発は `APP_ENV=development` のまま使える。

`apps/web/.env.stg` と `.env.prod` は秘密情報を空文字で上書きする公開テンプレート。開発用 `.env` の値を暗黙に使わないために置く。値は Git 管理外の `.env.stg.local` / `.env.prod.local` または CI の環境変数に設定する。

## 初回の準備

1. `packages/infra` で `bunx alchemy profile edit --add Cloudflare` を実行し、対象アカウントを設定する。
2. `apps/web/.env.stg.local` と `.env.prod.local` に次の値を設定する。

| 変数                    | stg                              | prod                           |
| ----------------------- | -------------------------------- | ------------------------------ |
| `BETTER_AUTH_SECRET`    | stg 専用の32文字以上のランダム値 | prod 専用の別の値              |
| `CORS_ORIGIN`           | 許可する HTTPS origin            | 許可する HTTPS origin          |
| `STRIPE_SECRET_KEY`     | `sk_test_...`                    | `sk_live_...`                  |
| `STRIPE_WEBHOOK_SECRET` | stg の Webhook の `whsec_...`    | prod の Webhook の `whsec_...` |

`RESEND_API_KEY` も各環境に設定する。認証メールは `ichiro <noreply@mail.ichiro.app>` から Resend で送る。GitHub Environments の Secrets にも `RESEND_API_KEY` を追加する。詳細は [認証メール](./auth-email.md)。

`BETTER_AUTH_URL` は Alchemy が Worker の URL を設定するので指定不要。ネイティブの認証では既存の `ichiro://` scheme を使う。

Stripe の Webhook は各 Worker URL の `/api/stripe/webhook` に作成する。イベントは `setup_intent.succeeded`、`payment_intent.succeeded`、`payment_intent.payment_failed`・`payment_intent.requires_action`。stg と prod で別エンドポイント・署名シークレットにする。

初回に Worker URL がまだ不明なら、任意のランダムな `whsec_...` を一時設定してデプロイする。出力された URL で Stripe の Webhook を作り、実際の署名シークレットへ置き換えて再デプロイする。一時設定の間は署名検証に失敗するため、ユーザーの利用・支払い登録・seed 投入は再デプロイ後に行う。

## 実行

リポジトリのルートで実行する。

```bash
bun run deploy:check:stg
bun run deploy:stg

bun run deploy:check:prod
bun run deploy:prod
```

`--check` は設定検証だけで、Cloudflare に接続しない。`bun run deploy:stg --dry-run` は Alchemy の変更計画を確認する。Alchemy の状態ストアの初期化が必要になる場合があるため、完全なオフライン検証ではない。

コマンドが `APP_ENV`・`ALCHEMY_STAGE`・`NODE_ENV` を揃えて渡す。外部から異なる stage が指定されていたら停止する。Alchemy を直接実行した場合も、スタック側で stage と設定を検証する。stg に本番 Stripe キー、prod にテストキーを渡すと停止する。

D1 のマイグレーションは `packages/db/src/migrations` からデプロイ時に適用する。stg で確認したコミットを prod にデプロイする。既存データと旧バージョンの Worker が読める変更にし、Worker の巻き戻しで DB の変更まで戻るとは考えない。

## ネイティブアプリ

prod の API は `https://ichiro.app` を使用する。`packages/infra/alchemy.run.ts` の `domain` を prod にだけ設定し、Alchemy が Custom Domain を管理する。Cloudflare の同じアカウントに Active な `ichiro.app` のゾーンが必要。`BETTER_AUTH_URL` は `Cloudflare.Worker.URL` から独自ドメインの URL に解決される。stg は既存の Worker URL を使う。

実機向けのクラウドビルド・内部配布は [EAS Build の手順](./eas-build.md)を参照する。既存の `preview` プロファイルから stg に接続する。

`apps/native/.env.stg.local` / `.env.prod.local` に次を設定する。

```dotenv
EXPO_PUBLIC_SERVER_URL=https://対象のWorkerのURL
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=対象環境の公開可能キー
```

stg は `pk_test_...`、prod は `pk_live_...` を使い、サーバーと同じ Stripe アカウントのキーにする。

```bash
bun run dev:native:stg
bun run dev:native:prod
```

Expo のビルドでも `APP_ENV=stg` または `APP_ENV=prod` と `EXPO_NO_DOTENV=1` を設定する。Expo が先に開発用 `.env` を process.env に入れて Varlock の環境別設定を上書きしないようにする。公開変数はバンドル時に決まるため、接続先を変えたら再起動・再ビルドする。開発用 Expo の `NODE_ENV` は Expo に任せる。

アプリ名・Bundle ID・scheme は既存のまま。この構成は接続先の切り替えを提供する。端末へ stg / prod を同時にインストールする配布設定は別途必要。

## GitHub Actions

`.github/workflows/deploy.yml` は `main` への push で stg にデプロイする。prod は workflow_dispatch で `stage=prod` と検証済みの40文字コミット SHA を指定する。同じ SHA の main push による stg デプロイが成功していない場合は停止する。

GitHub Environments に `stg` と `prod` を作成し、それぞれに設定する。

- Variables: `CLOUDFLARE_ACCOUNT_ID`、`CORS_ORIGIN`
- Secrets: `CLOUDFLARE_API_TOKEN`、`BETTER_AUTH_SECRET`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`

Cloudflare のトークンには Worker・D1・R2 と Alchemy の状態ストアを管理する権限が必要。初回はローカルで状態ストアを作成し、CI から使えることを確認する。prod Environment には必要に応じて承認者・ブランチ制限を設定する。

型検査・API とインフラのテストを通してからデプロイする。同じ環境のデプロイは直列化し、途中キャンセルによる状態不整合を避ける。

## 確認

- Worker の `/` がログインなしでサービス紹介の HTML を返すことを確認する。
- Cloudflare 上で Worker・D1・R2 が stg / prod で別リソースになっていることを確認する。
- stg のアプリで新規登録・ログイン・画像アップロード・支払い登録を行う。
- prod に stg のユーザー・画像・支払い情報が存在しないことを確認する。
- stg の Stripe テスト環境で Webhook と毎時5分の徴収ジョブを確認する。
- 全ストーリーの回帰テストは `bun run test`、画面の確認は iOS Simulator で行う。

データ作成には既存の `packages/db/src/seed/run.ts` を使う。ローカル検証は `bun run db:seed -- --url file:/tmp/ichiro-stg-qa.db`。stg の D1 に投入するときはその DB の `CLOUDFLARE_DATABASE_ID` と `CLOUDFLARE_ACCOUNT_ID`・`CLOUDFLARE_D1_TOKEN` を指定し、`packages/db` から `bun run src/seed/run.ts` を実行する。デモ seed は既存のデモユーザーを作り直すため、prod には投入しない。

## 参考

- [Alchemy deploy](https://alchemy.run/cli/deploy/)
- [Varlock の環境分離](https://varlock.dev/guides/environments/)
- [Varlock のモノレポ設定](https://varlock.dev/guides/monorepos/)

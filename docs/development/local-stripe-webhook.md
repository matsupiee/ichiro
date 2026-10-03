# Stripe の webhook を開発サーバーで受け取る

`bun run dev:stripe` で Stripe CLI と API サーバーを起動し、署名シークレットを自動で受け渡す。
支払い方法の登録や罰金の徴収を、実際の Stripe テスト環境に接続して確認するときに使う。

## 前提

Bun とプロジェクトの依存パッケージ、Stripe CLI をインストールし、通常の開発用環境設定を用意する。
コマンドはリポジトリのルートで実行する。

macOS の Stripe CLI は `brew install stripe/stripe-cli/stripe` で導入する。
Linux は [Stripe CLI のインストール手順](https://docs.stripe.com/stripe-cli) に従う。

`apps/server/.env` またはプロセスの環境変数に `STRIPE_SECRET_KEY=sk_test_...` を設定する。
環境変数の値を優先する。CLI にも同じテスト用キーを渡すので、`stripe login` は不要。
`STRIPE_WEBHOOK_SECRET` は接続時に取得するため、空でもよい。

## 起動

```bash
bun run dev:stripe
```

Stripe の接続が完了すると、署名シークレットを環境変数で渡して API サーバーが起動する。
転送先は `http://localhost:3000/stripe/webhook`。公開 URL の登録は不要。
`.env` は書き換えず、コマンドの出力ではキーを伏せる。

3000番が使用中なら既存のサーバーを停止するか、別のポートを指定する。
複数起動時もローカル D1 は共有される。

```bash
bun run dev:stripe --port 3001
```

## 受信の確認

別のターミナルで `bun run dev:native` を起動し、アプリから支払い方法を登録する。
アプリの公開キーも同じ Stripe テスト環境のものを使う。
ポートを変更した場合は、アプリの `EXPO_PUBLIC_SERVER_URL` も対応する URL に変更して起動する。

CLI のログでイベントの転送と HTTP 200 を確認し、アプリや DB に結果が反映されることを確かめる。
操作手順と期待する結果は、[支払い方法の登録](../user-stories/register-payment-method.md)と[罰金の徴収](../user-stories/penalty-collection.md)を参照する。

CLI の購読対象は `setup_intent.succeeded`・`payment_intent.succeeded`・`payment_intent.payment_failed`・`payment_intent.requires_action`。
`stripe trigger` の生成データはアプリの顧客や罰金と一致しないため、HTTP 200 だけでは DB 反映の確認にならない。

## 確認用データの作成

既存のローカル D1 と `packages/db/src/seed/run.ts` の seed コマンドを使う。
[Drizzle Studio の起動手順](./local-d1-studio.md)で SQLite の絶対パスを確認し、次を実行する。

```bash
bun run db:seed -- --url file:/絶対パス/ローカル.sqlite
```

実際の決済確認には `--stripe-customer cus_... --stripe-payment-method pm_...` も指定する。
通常の seed の支払い方法 ID は Stripe に実在しない。

## 終了と接続失敗時の動作

Ctrl+C で Stripe CLI、API サーバーとその子プロセスを停止する。
片方のプロセスが終了した場合も、もう片方を停止する。

キーの認証失敗時はサーバーを起動しない。接続が30秒以内に完了しない場合も終了する。
`sk_live_...` は受け付けない。使用中のポートへ誤って転送しない。

## クラウド開発環境での実行

セットアップで Linux 用 Stripe CLI を導入し、テスト用キーを環境変数で渡す。
Stripe の API と CLI のイベント受信接続をネットワーク設定で許可し、タスク中はこのコマンドを起動したままにする。
実際のクラウド環境で接続が許可されるかは別途確認する。
Linux 上では iOS Simulator は動かないため、API の確認と Mac 上の画面確認を分ける。

## 自動テスト

`bun run test` で既存のストーリーに対応する API テストと起動コマンドのテストをまとめて実行する。

- `packages/infra/scripts/dev-stripe.test.mjs`：環境設定、署名シークレットの受け渡し、ログの秘匿、起動失敗、接続タイムアウト、ポート競合、終了処理。
- `packages/api/src/shared/payment/handle-stripe-event.integration.test.ts`：受信したイベントの DB 反映。

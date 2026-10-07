# 罰金を払うカードを Stripe に登録できる

> ステータス: 実装済み（ブラウザで Stripe の Payment Element を使ってカードを登録する。Apple Pay・Google Pay は使わない）

## ストーリー

罰金を設定するユーザーとして、罰金を払うカードを一度だけ登録しておきたい。
登録しておけば、報告できなかったときに自分で支払い操作をしなくても、確実に引き落とされるから。

## 動作確認の手順

Stripe のテスト環境のキーを設定しておく。サーバーの環境変数（`apps/web/.env` など）に `STRIPE_SECRET_KEY`（sk_test_...）、`STRIPE_PUBLISHABLE_KEY`（pk_test_...）、`STRIPE_WEBHOOK_SECRET` を入れる。
公開可能キーはビルドに埋め込まず、サーバーから画面に渡す。テスト用のキーがないまま追加しようとすると、「支払い方法を登録できませんでした」のダイアログが出る。
Webhook も受け取るときは `bun run dev:stripe` で開発サーバーを起動する。→ [Stripe の webhook を開発サーバーで受け取る](../development/local-stripe-webhook.md)
ブラウザで http://localhost:3000/app を開いて確かめる。

1. 新規登録して、ホームの右上のアカウントのボタンから `/app/account` を開く。
   - 「支払い情報」に「未登録」と「支払い方法を追加」の行が出る。
   - → [アカウントを管理できる](./profile-sheet.md)
2. 「支払い方法を追加」を押す。
   - アプリ内のダイアログ「支払い方法を追加」が開き、中に Stripe の Payment Element（カード番号・有効期限・セキュリティコードの入力欄）が出る。
   - 入力欄はカードだけで、Apple Pay・Google Pay のボタンは出ない。
   - 「カード情報は Stripe で安全に登録されます。ichiro にはカード番号を保存しません。」と出る。
   - Stripe.js はこのときに初めて読み込まれる。ほかの画面では読み込まない。
3. 「キャンセル」を押す。Esc キーで閉じてもよい。
   - ダイアログが閉じ、何も登録されない。エラーのダイアログも出ない。
4. もう一度「支払い方法を追加」を押し、テストカード 4242 4242 4242 4242（有効期限は未来の日付、セキュリティコードは任意の3桁）を入れて「登録する」を押す。
   - 送信中は「登録中…」になり、二重に送信できない。
   - ダイアログが閉じ、「支払い情報」に「Visa •••• 4242」が出る。「未登録」は消える。
5. 拒否されるテストカード（4000 0000 0000 0002 など）で登録する。
   - ダイアログは閉じず、その中に Stripe のエラーメッセージが出る。何も登録されない。
6. 本人認証が必要なテストカード（4000 0025 0000 3155 など）で登録する。
   - Stripe が同じ画面の上で本人認証（3D セキュア）の画面を出す。ページは移動しない。
   - 認証を完了すると登録され、失敗させると登録されずにダイアログ内にエラーが出る。
7. コミットメント作成ページで「罰金を設定する」をオンにする。
   - 「支払い方法」に、登録した支払い方法がラジオボタンで並び、最初に登録したものが選ばれている。
   - 下の「＋ 支払い方法を追加」から、同じダイアログでその場で追加もできる。追加したものが選ばれた状態になる。
   - → [コミットメントを作成できる](./create-commitment.md)
8. 支払い方法をひとつも登録していないアカウントで、罰金ありのコミットメントを宣言しようとする。
   - 「カードを登録してください。登録は Stripe で安全に行われます。」と出る。
   - そのまま「宣言する」を押すと「支払い方法を選んでください」と出て、作成されない。
9. 報告できなかった日の罰金が、選んだ支払い方法から引き落とされる。
   - → [報告できなかった日は罰金が徴収される](./penalty-collection.md)

手順5・6の実際のカード入力と本人認証は、Stripe のテスト環境に接続して手動で確認する。自動テストでは Stripe に接続しない。

## データの持ち方

- `payment_customer` テーブルに、ユーザーと Stripe の Customer の対応を1ユーザー1行で持つ。
  - 初めて「支払い方法を追加」を押したときに Customer を作る。同時に押されても2つできないよう、ユーザーごとの冪等キーを付ける。
- `payment_method` テーブルに、登録した支払い方法を1件1行で持つ。
  - カード番号そのものは持たない。Stripe の PaymentMethod の ID と、表示用のカードの種類（`brand`）・下4桁（`last4`）・ウォレット（`wallet`）だけを写す。
  - Web 版はカードだけを登録するので、`wallet` は空になる。以前のネイティブアプリで Apple Pay 経由で登録した行は `wallet` が `apple_pay` のまま残り、「Apple Pay（Visa •••• 1234）」のように表示する。
  - 同じ PaymentMethod は1行だけ（`stripe_payment_method_id` のユニーク制約）。
- 登録の流れ（[Stripe の「将来の支払いのために保存する」](https://docs.stripe.com/payments/save-and-reuse) の手順に沿う）。
  - 画面が `consumer.payment.startSetup` を呼ぶと、サーバーが SetupIntent（`usage: off_session`、カードのみ）を作り、client secret だけを返す。
  - 公開可能キーは環境変数 `STRIPE_PUBLISHABLE_KEY`（pk_test_ / pk_live_）をサーバーから渡す。Stripe.js は `@stripe/stripe-js/pure` で、追加するときだけ読み込む（`apps/web/src/lib/stripe.ts`）。
  - Payment Element で `confirmSetup` を行い、登録を終えたら `consumer.payment.completeSetup` を呼ぶ。サーバーは SetupIntent が自分の Customer のもので、登録が終わっていることを Stripe に確かめてから保存する。
  - 画面からの `completeSetup` が届かなかったときのため、Webhook（`/api/stripe/webhook`）の `setup_intent.succeeded` でも保存する。
- `commitment.payment_method_id` に、罰金を引き落とす支払い方法を持つ。自分が登録したものしか選べない。
  - 外部キーの `ON DELETE RESTRICT` により、コミットメントが参照している支払い方法は削除できない。参照されていない支払い方法は削除できる。

## 対応するテスト

- `apps/web/e2e/payment.spec.ts`：Stripe.js の代わりの偽物（`apps/web/e2e/support/fake-stripe.ts`）で、追加するまで Stripe.js を読み込まないこと、公開可能キーをサーバーから受け取ること、Payment Element のダイアログの表示・キャンセル・拒否・登録完了（画面遷移なしの確定）と登録後の表示、支払い方法がないまま罰金ありでは宣言できないことを確かめる。実際のカード入力と 3D セキュアは Stripe のテスト環境で手動で確認する。
- 削除制約は `packages/api/src/shared/payment/payment-method-deletion.integration.test.ts`。`packages/db/src/seed/run.ts` の既存デモデータを使って確かめる。
- `packages/api/src/routers/consumer/payment/start-setup/handler.integration.test.ts` と `packages/api/src/routers/consumer/payment/complete-setup/handler.integration.test.ts`
- Webhook での保存は `packages/api/src/shared/payment/handle-stripe-event.integration.test.ts`
- API のテストでは、Stripe を `packages/api/src/test/fake-stripe.ts` の偽物に差し替える。

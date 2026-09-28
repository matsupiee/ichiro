# 罰金を払うカードや Apple Pay を Stripe に登録できる

> ステータス: 実装済み（登録は iPhone・Android のアプリのみ。Web では登録できない）

## ストーリー

罰金を設定するユーザーとして、罰金を払うカードや Apple Pay を一度だけ登録しておきたい。
登録しておけば、報告できなかったときに自分で支払い操作をしなくても、確実に引き落とされるから。

## 動作確認の手順

Stripe のテスト用のキーを設定しておく。サーバーに `STRIPE_SECRET_KEY`（sk_test_...）と `STRIPE_WEBHOOK_SECRET`、アプリに `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`（pk_test_...）。
Stripe のネイティブ SDK を使うので、iOS シミュレーターか実機の開発ビルド（`bun run ios` など）で確かめる。

1. 新規登録して、右上のプロフィールアイコンからシートを開く。
   - 「支払い情報」に「未登録」と「支払い方法を追加」の行が出る。
2. 「支払い方法を追加」を押す。
   - Stripe の PaymentSheet が下から開く。カード番号の入力欄と、Apple Pay が使える端末では Apple Pay のボタンが出る。
   - テストカード 4242 4242 4242 4242（有効期限は未来の日付、CVC は任意の3桁）を入れて登録する。
   - シートが閉じ、「支払い情報」に「Visa •••• 4242」が出る。「未登録」は消える。
   - PaymentSheet を閉じただけのときは、何も登録されず、アラートも出ない。
3. Apple Pay で登録する（Apple Pay が使える端末のみ）。
   - 「Apple Pay（Visa •••• 1234）」のように、Apple Pay 経由であることが分かる表示で出る。
4. コミットメント作成ページで「罰金を設定する」をオンにする。
   - 「支払い方法」に、登録した支払い方法がラジオボタンで並び、最初に登録したものが選ばれている。
   - 下の「＋ 支払い方法を追加」から、その場で追加もできる。追加したものが選ばれた状態になる。
   - → [コミットメントを作成できる](./create-commitment.md)
5. 支払い方法をひとつも登録していないアカウントで、罰金ありのコミットメントを宣言しようとする。
   - 「カードか Apple Pay を登録してください。登録は Stripe で安全に行われます。」と出る。
   - そのまま「宣言する」を押すと「支払い方法を選んでください」と出て、作成されない。
6. 報告できなかった日の罰金が、選んだ支払い方法から引き落とされる。
   - → [報告できなかった日は罰金が徴収される](./penalty-collection.md)

## データの持ち方

- `payment_customer` テーブルに、ユーザーと Stripe の Customer の対応を1ユーザー1行で持つ。
  - 初めて「支払い方法を追加」を押したときに Customer を作る。同時に押されても2つできないよう、ユーザーごとの冪等キーを付ける。
- `payment_method` テーブルに、登録した支払い方法を1件1行で持つ。
  - カード番号そのものは持たない。Stripe の PaymentMethod の ID と、表示用のカードの種類（`brand`）・下4桁（`last4`）・ウォレット（`wallet`、Apple Pay なら `apple_pay`）だけを写す。
  - 同じ PaymentMethod は1行だけ（`stripe_payment_method_id` のユニーク制約）。
- 登録の流れ。
  - アプリが `consumer.payment.startSetup` を呼ぶと、サーバーが SetupIntent（`usage: off_session`、カードのみ）と端末用の一時キーを作って返す。Apple Pay もカードとして登録される。
  - アプリが PaymentSheet を開き、ユーザーが登録を終えたら `consumer.payment.completeSetup` を呼ぶ。サーバーは SetupIntent が自分の Customer のもので、登録が終わっていることを Stripe に確かめてから保存する。
  - アプリからの `completeSetup` が届かなかったときのため、Webhook の `setup_intent.succeeded` でも保存する。
- `commitment.payment_method_id` に、罰金を引き落とす支払い方法を持つ。自分が登録したものしか選べない。
  - 外部キーの `ON DELETE RESTRICT` により、コミットメントが参照している支払い方法は削除できない。参照されていない支払い方法は削除できる。

## 対応するテスト

- 削除制約は `packages/api/src/shared/payment/payment-method-deletion.integration.test.ts`。`packages/db/src/seed/run.ts` の既存デモデータを使って確かめる。
- `packages/api/src/routers/consumer/payment/start-setup/handler.integration.test.ts` と `packages/api/src/routers/consumer/payment/complete-setup/handler.integration.test.ts`
- Webhook での保存は `packages/api/src/shared/payment/handle-stripe-event.integration.test.ts`
- Stripe は `packages/api/src/test/fake-stripe.ts` の偽物に差し替えて確かめる。PaymentSheet の画面そのものは自動テストしていない。

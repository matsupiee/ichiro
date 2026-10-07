# アカウント画面でアカウントを管理できる

> ステータス: 実装済み。

## ストーリー

ログイン中のユーザーとして、写真や名前を変えたり、ログアウトしたりしたい。
自分のアカウントだと分かりやすくなるから。

## 動作確認の手順

`bun run db:seed -- --url file:/絶対パス/対象.sqlite --skip-migrations` でデモデータを入れ、`bun run dev:server` を起動する。
ブラウザで http://localhost:3000/app を開き、demo@ichiro.app / password123 でログインする。

1. ホームの右上のアカウントのボタン（写真か人型アイコン）を押す。
   - アカウント画面（`/app/account`）が開く。
   - 右上の ✕ を押すとホームへ戻る。
2. 「プロフィール写真」の行を押す。
   - 「写真を選択」「削除」のメニューが出る。
   - 「写真を選択」を押すとファイルの選択が開き、選んだ写真が中央で正方形に切り抜かれてサーバーに保存され、アカウント画面とホームのアイコンに出る。
   - ページを読み込み直しても、ほかのブラウザでログインしても写真は残る。
   - 「削除」を押すと、ホームの右上は人型アイコンに戻り、アカウント画面の行は灰色の丸に戻る。
   - → [プロフィール写真をアップロードできる](./upload-profile-photo.md)
3. 「名前」の行を押す。
   - 「名前を編集」のダイアログが開き、今の名前が入っている。
   - 名前を変えて「保存」を押すと、アカウント画面の名前が変わる。
   - 空のまま保存すると「名前を入力してください」と表示され、変わらない。
   - 「キャンセル」か Esc キーで、変えずに閉じる。
4. 「メールアドレス」の行を押す。
   - メールアドレスの変更画面（`/app/change-email`）が開き、現在のアドレスを確認して変更できる。
   - → [新しいメールアドレスを確認して変更できる](./change-email.md)
5. 「支払い情報」を見る。
   - Stripe に登録ずみの支払い方法が「Visa •••• 4242」「Mastercard •••• 4444」のように並ぶ。デモデータではこの2つ。
   - 登録がなければ「未登録」と出る。
   - 「支払い方法を追加」を押すと、ダイアログ「支払い方法を追加」に Stripe の Payment Element が開いて追加できる。ローカルで Stripe のテストキーがないときはエラーのダイアログになる。
   - → [罰金を払うカードを Stripe に登録できる](./register-payment-method.md)
6. メニューの各行を押す。
   - 利用規約・特定商取引法に基づく表記・プライバシーポリシーが別のタブで開く。
   - → [アプリ内で利用条件と個人情報の取り扱いを確認できる](./read-legal-documents.md)
   - 「問い合わせ・報告」からメールを作成できる。
   - → [メールで問い合わせ・報告できる](./contact-support.md)
7. 「ログアウト」を押す。
   - はじめにの画面（`/app/welcome`）に戻る。
   - → [アプリを開いたら新規登録とログインを選べる](./onboarding.md)
8. もう一度ログインしてアカウント画面を開き、一番下の赤字の「退会」を押す。
   - 退会の画面（`/app/withdrawal`）が開き、注意事項を確認して退会できる。
   - → [退会してログインと罰金の請求を停止できる](./withdrawal.md)

## データの持ち方

- 名前は `user.name`。Better Auth の `updateUser` で書きかえる。
- 支払い情報は `payment_method` テーブル。`consumer.payment.listMethods` で自分の分だけを返す。
  - 表示は `apps/web/src/lib/payments.ts` の `paymentMethodLabel`。`wallet` 列に値があれば「Apple Pay（Visa •••• 4242）」のように出す。
- プロフィール写真は `user.image`。写真の本体は Cloudflare R2 に置く。
  - → [プロフィール写真をアップロードできる](./upload-profile-photo.md)
- 画面は `apps/web/src/routes/app/_member/account.tsx`。新しいテーブルや API はない。

## 対応するテスト

- `apps/web/e2e/account.spec.ts`：アカウント画面の開閉、名前の変更と空のときのエラー、支払い情報の表示、メニューの各行、ログアウト。
- プロフィール写真は `packages/api/src/routers/consumer/profile/` 配下の各 `handler.integration.test.ts`。
- 支払い情報は `packages/api/src/routers/consumer/payment/list-methods/handler.integration.test.ts`。
- メール確認・変更・ログアウトは `packages/api/src/test/auth.integration.test.ts`。

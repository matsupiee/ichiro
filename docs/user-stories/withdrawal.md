# 退会してログインと罰金の請求を停止できる

> ステータス: 即時の利用・請求停止は実装済み。保存期限に従うデータ削除は運営対応で、自動削除は未実装。

## ストーリー

利用を終了するユーザーとして、アカウント画面から退会したい。そのアカウントでログインできなくなり、罰金の請求が止まるようにしたい。

## 動作確認の手順

1. ローカル D1 に `bun run --cwd packages/db db:seed:withdrawal --url file:/絶対パス/対象.sqlite --skip-migrations` で専用アカウントを作り、表示された認証情報でブラウザからログインする。
   - seed は既存アカウントを上書きしない。`--email withdrawal-2@ichiro.example` のように別のテスト用メールアドレスを指定すると、既存データを上書きせず再実行できる。
2. ホームの右上のアカウントのボタンを押し、アカウント画面の一番下の「退会」を押す。
   - 退会の画面（`/app/withdrawal`）が開き、「ichiro の退会」の見出しと注意事項が表示される。
   - ヘッダーの戻るボタンでアカウント画面に戻る。再度開いたときはチェックが外れている。
3. チェックを付けずに「退会」を押す。
   - ボタンは無効で、退会は実行されない。
4. 「注意事項を確認しました」にチェックを付け、「退会」を押す。
   - 送信中はボタンが「処理中…」になり、二重送信や戻る操作ができない。
   - 完了するとログアウトし、画面に「退会しました」「ご利用ありがとうございました。」と「トップへ戻る」が表示される。
   - 「トップへ戻る」を押すと、未ログインの紹介ページ（`/`）に戻る。
   - 実行中の操作や Stripe の応答を待たずに退会が完了する。退会前に開始した決済は退会後に完了する場合がある。
5. 同じ認証情報でログインする。
   - 正しいパスワードでも退会済みの案内が表示され、ログインできない。
   - ほかのブラウザのセッションも失効している。
6. API テストで退会後の定期処理と遅延 Webhook を実行する。
   - 罰金は新規生成・請求・再試行されない。
   - 即時の退会処理では既存のアカウント・記録・支払い情報は保持される。以後の削除期限は [保存期間と削除対応](../development/privacy-retention.md) に従う。
   - 開始済みの決済結果は退会後も保存するが、次の請求や再試行は行わない。
   - → [未報告の罰金を精算し、Stripeで徴収できる](./penalty-collection.md)

## データの持ち方

- `user.withdrawnAt` に退会日時を保存する。退会状態を表すカラムはこの1つだけとする。
- 退会日時の保存とセッション失効は D1 の batch で同時に確定する。
  - 画面（`apps/web/src/routes/app/_member/withdrawal.tsx`）は完了後に Better Auth の `signOut` も呼び、ブラウザの Cookie を消す。
- Better Auth の `databaseHooks.session.create.before` で退会済みユーザーのログインを拒否する。
  - 同時ログインによる確認後のセッション作成も DB トリガーで拒否する。
- アカウント・コミットメント・報告・罰金・支払い情報は削除しない。独自のメールアドレス禁止リストは作成しない。

## 対応するテスト

- `apps/web/e2e/account.spec.ts`：退会の画面の表示、チェック前の無効なボタン、退会の完了表示、退会後にログインできないこと。
- `packages/api/src/routers/consumer/account/withdraw/handler.integration.test.ts`
- `packages/api/src/test/auth.integration.test.ts`
- `packages/api/src/test/withdrawal-migration.integration.test.ts`
- `packages/api/src/test/withdrawal-seed.integration.test.ts`

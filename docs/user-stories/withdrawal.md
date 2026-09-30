# 退会してログインと罰金の請求を停止できる

> ステータス: 実装済み。

## ストーリー

利用を終了するユーザーとして、アカウント画面から退会したい。そのアカウントでログインできなくなり、罰金の請求が止まるようにしたい。

## 動作確認の手順

1. ローカルDBに `bun run --cwd packages/db db:seed:withdrawal --url file:/絶対パス/対象.sqlite --skip-migrations` で専用アカウントを作り、表示された認証情報でネイティブアプリにログインする。
   - seed は既存アカウントを上書きしない。`--email withdrawal-2@ichiro.example` のように別のテスト用メールアドレスを指定すると、既存データを上書きせず再実行できる。
2. ホーム右上のアカウントアイコンを押し、メニューの一番下の「退会」を押す。
   - 同じシートが「ichiro の退会」に切り替わり、注意事項が表示される。
   - 戻るとアカウントシートに戻る。再度開いたときはチェックが外れている。
3. チェックを付けずに「退会」を押す。
   - ボタンは無効で、退会は実行されない。
4. 「注意事項を確認しました」にチェックを付け、「退会」を押す。
   - 送信中は二重送信とシートの閉鎖ができない。
   - 完了するとログアウトし、「退会しました」と表示される。
   - 実行中の操作やStripeの応答を待たずに退会が完了する。退会前に開始した決済は退会後に完了する場合がある。
5. 同じ認証情報でログインする。
   - 正しいパスワードでも退会済みの案内が表示され、ログインできない。
   - 他の端末のセッションも失効している。
6. APIテストで退会後の定期処理と遅延Webhookを実行する。
   - 罰金は新規生成・請求・再試行されない。
   - 既存のアカウント・記録・支払い情報は保持される。
   - 開始済みの決済結果は退会後も保存するが、次の請求や再試行は行わない。
   - → [未報告の罰金を精算し、Stripeで徴収できる](./penalty-collection.md)

## データの持ち方

- `user.withdrawnAt` に退会日時を保存する。退会状態を表すカラムはこの1つだけとする。
- 退会日時の保存とセッション失効は D1 の batch で同時に確定する。
- Better Auth の `databaseHooks.session.create.before` で退会済みユーザーのログインを拒否する。
  - 同時ログインによる確認後のセッション作成もDBトリガーで拒否する。
- アカウント・コミットメント・報告・罰金・支払い情報は削除しない。独自のメールアドレス禁止リストは作成しない。

## 対応するテスト

- `packages/api/src/routers/consumer/account/withdraw/handler.integration.test.ts`
- `packages/api/src/test/auth.integration.test.ts`
- `packages/api/src/test/withdrawal-migration.integration.test.ts`
- `.maestro/withdrawal-login.yaml` と `.maestro/withdrawal.yaml`

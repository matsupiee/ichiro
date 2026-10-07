# パスワードを忘れたときに再設定する

> ステータス: 実装済み

## ストーリー

登録済みの利用者として、パスワードを忘れても登録したメールアドレスで本人確認し、新しいパスワードで利用を再開したい。

## 動作確認の手順

1. `AUTH_EMAIL_DELIVERY=console bun run dev:server` で開発サーバーを起動し、`bun run --cwd packages/db db:seed:password-reset --url file:/絶対パス/ローカル.sqlite --skip-migrations` で専用ユーザーを作る。
   - メールアドレスは `password-reset@ichiro.example`、初期パスワードは `reset-demo-password`。DB が未移行なら `--skip-migrations` を省く。
   - E2E 用の `bun run --cwd packages/db db:seed:e2e` でも同じユーザーが作られる。
2. ブラウザでログイン画面（http://localhost:3000/app/sign-in）を開き、メールアドレスを入力してから「パスワードを忘れた方はこちら」を押す。
   - パスワード再設定画面（`/app/reset-password`）に移り、入力済みのメールアドレスが引き継がれる。
3. 登録メールアドレスを入力して「認証コードを送信する」を押す。
   - 6桁コードと新しいパスワードを入力する段階になる。未登録のアドレスも同じ案内になり、アカウントの有無を明かさない。
   - メール送信の失敗はエラーになり、再試行できる。
4. 開発サーバーのログの `local-auth-email` に出たコードと、新しいパスワードを入力する。
   - パスワードは8文字以上128文字以内。誤コード・5分経過したコード・別用途のコードは使えない。
   - 誤コードの入力は5回まで。コードの再送は60秒後から可能で、再送すると前のコードは使えない。
   - 送信は同一IPで1分に5回、再設定は1分に10回まで。
   - アドレスを間違えた場合は「メールアドレスを変更する」から戻って修正できる。
   - パスワード欄の目のボタンで入力内容を確認できる。
   - → [入力したパスワードを表示して確認する](./password-visibility.md)
5. 「パスワードを再設定する」を押し、完了の案内から「ログイン画面へ」を押す。
   - 自動ログインはせず、新しいパスワードでログインできる。旧パスワードは使えない。
   - 既存セッションはすべて無効になる。コードの再利用や並列使用は成功しない。
   - メール未確認のアカウントも、再設定コードによる所有確認でメール確認済みになる。
   - 退会済みアカウントには送信せず、退会前に受信したコードでも復旧できない。
   - → [メールアドレスを確認して利用を始められる](./verify-email.md)
   - → [退会してログインと罰金の請求を停止できる](./withdrawal.md)

## データの持ち方

- `verification` に再設定専用コードのハッシュ、有効期限、試行回数を保存する。
  - Better Auth の Email OTP を利用し、コードは一度しか使えない。
- `account.password` に新しいパスワードのハッシュを保存する。
- 再設定成功時は対象ユーザーの `session` を削除する。
- `rate_limit` に IP ごとの操作回数を保存する。`db:seed:password-reset` では制限を解除しない。E2E 用の `db:seed:e2e` は制限の記録を消す。
- 画面は `apps/web/src/routes/app/_guest/reset-password.tsx`。

## 対応するテスト

- `packages/api/src/test/password-reset.integration.test.ts`
- `apps/web/src/server/auth-mail.test.ts`
- `apps/web/e2e/password-reset.spec.ts`：ログイン画面からの移動、コードの送信、ログのコードでの再設定、新しいパスワードでのログイン、パスワードの表示の切り替え。

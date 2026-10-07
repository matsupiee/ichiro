# 登録済みメールアドレスからログインへ進める

> ステータス: 実装済み。

## ストーリー

登録済みのユーザーとして、新規登録で同じメールアドレスを入力したときに登録済みだと分かり、そのままログインしたい。

## 動作確認の手順

1. `bun run --cwd packages/db db:seed:email-verification --url file:/絶対パス/対象.sqlite --skip-migrations --verified` で専用ユーザーを準備する。
   - `packages/db/src/seed/email-verification.ts` の既存コマンドを使用する。
   - メールアドレスは `otp@ichiro.example`、パスワードは `otp-demo-password`。
   - E2E 用の `bun run --cwd packages/db db:seed:e2e` でも、確認済みの同じユーザーが作られる。
2. 未ログインのブラウザで http://localhost:3000/app/sign-up を開き、名前、上記アドレス、8文字以上の別パスワードを入力して登録する。
   - `/app/sign-in?email=…&reason=already-registered` に移り、「登録済みのアカウントです。ログインしてください」と表示される。
   - メールアドレスが引き継がれ、パスワード欄は空になる。パスワードは URL に含まれない。
   - 新しいアカウントや確認メールは作られず、既存の名前・パスワードは変更されない。
   - メールアドレスの英字を大文字にしても同じ案内になる。
3. 元のパスワードを入力してログインする。
   - ログインしてホームへ進める。
4. ログアウトし、`--verified` を外して seed を再実行してから手順2・3を繰り返す。
   - 未確認のアカウントでも重複登録時はログインへ案内される。
   - 正しいパスワードでログインするとメール確認画面に進み、確認を再開できる。
   - → [メールアドレスを確認して利用を始められる](./verify-email.md)

## データの持ち方

- Better Auth が正規化したメールアドレスで既存ユーザーを検出する。
- `onExistingUserSignUp` で422と `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` を返す。
  - 登録済みかどうかを明示する仕様とし、既定の重複時の成功応答を変更する。
  - 登録時の回数制限とメール確認の必須条件は維持する。
- ログイン画面への移動では、クエリにメールアドレスと案内の識別子（`reason=already-registered`）だけを渡す。パスワードは渡さない。
  - 受け取り側は `apps/web/src/routes/app/_guest/sign-in.tsx`。

## 対応するテスト

- `packages/api/src/test/auth.integration.test.ts`：確認済み・未確認、大小文字、既存情報とコードの維持、追加メール・セッションの不発行、元のパスワードでのログイン・確認再開。
- `apps/web/e2e/onboarding.spec.ts`：重複登録、案内、メールアドレスの引き継ぎ、空のパスワード欄、元のパスワードでのログイン。

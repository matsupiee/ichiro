# 認証メールの開発と確認

## 送信設定

Resend に登録・認証済みの `mail.ichiro.app` を使う。送信元は `ichiro <noreply@mail.ichiro.app>`。
`apps/server/.env`、`.env.stg.local`、`.env.prod.local` の各環境に `RESEND_API_KEY` を設定する。キーを Git やアプリへ入れない。
`AUTH_EMAIL_FROM` と `AUTH_EMAIL_DELIVERY=resend` は `.env.schema` の既定値を使える。
Alchemy はキーを秘密情報として Worker に渡す。`bun run deploy:check:stg` / `bun run deploy:check:prod` で事前検証する。
送信専用キーは `mail.ichiro.app` に限定できる。受信サービスや `noreply` のメールボックス作成は不要。

Resend への要求が成功してから応答する。10秒でタイムアウトし、失敗時に成功表示を出さない。
Better Auth の既定のバックグラウンド処理は送信エラーを握りつぶすため、プラグインで待機とエラーの伝播を明示している。
Resend の応答本文や認証コードを本番ログに出さない。

## 回数制限の保存

[Better Auth の公式ガイド](https://better-auth.com/docs/concepts/rate-limit)に従い、`rateLimit.storage: "database"` と標準の `rateLimit` モデルを使う。物理テーブル名は `rate_limit`。
独自の `auth_rate_limit` とカウンター実装、メールアドレス単位の毎分・毎時制限は削除した。
登録・送信系は同じIP・APIごとに60秒に5回、ログイン・コード確認系は10回。最後に受け付けた操作から60秒経つと回数がリセットされる。
ネイティブの再送ボタンには60秒の待機表示を残す。OTPの有効期限5分・誤入力5回は Email OTP プラグインが管理する。

本番未適用のマイグレーションを `20260930055501_new_lionheart` に統合し、標準テーブルを直接作成する。独自テーブルを作成してから削除する中間マイグレーションは残さない。確認用ローカル D1 は標準テーブルへ移行済みで、ユーザー・セッションを保持したまま適用履歴も統合している。
OTPの保存も標準の `storeOTP: "hashed"` に変更したため、切り替え前に発行した未使用コードは再送が必要になる。

## ローカルでの確認

実際の受信を使わない場合、`AUTH_EMAIL_DELIVERY=console bun run dev:server` で起動する。
この方法は `APP_ENV=development` または `test` のみ許可する。API の標準出力に `local-auth-email` とコードを出すため、ローカルテスト専用アドレスだけを使う。

既存の未認証ユーザーの再開は次のコマンドで準備する。

```sh
bun run --cwd packages/db db:seed:email-verification --url file:/absolute/path/to/local.sqlite
```

Alchemy が移行済みの DB には `--skip-migrations` を付ける。ローカル D1 の場所は [ローカル D1 の操作](./local-d1-studio.md)を参照する。
`otp@ichiro.example` / `otp-demo-password` でログインし、確認画面でコードを再送する。
固定コードや認証を省略する本番用の分岐は作らない。seed は専用ユーザーだけを未認証に戻し、回数制限を解除しない。

実送信の疎通確認には Resend のテスト受信先 `delivered+任意の名前@resend.dev` を使える。
管理画面で送信元と配信結果を確認する。これは一般の受信箱への到達や迷惑メール判定を保証するテストではない。

## テスト

```sh
bun run test
bun run check-types
bun run check:patterns
```

全ユーザーストーリーに対応するAPI・サーバー・インフラの回帰テストを実行する。
画面は iOS Simulator または実機で [登録確認](../user-stories/verify-email.md)と[アドレス変更](../user-stories/change-email.md)を操作する。
ブラウザや Expo Web で代用しない。メール確認後にホームへ進むことを確かめる。

通常のログインは確認済みアドレスとパスワードを使う。今回の実装は毎回のログインに二要素認証を要求しない。
セキュリティの申告では「登録時のメールアドレス確認」「ログイン試行回数の制限」を選び、毎回の多要素認証として申告しない。

利用規約は登録・変更時の確認、プライバシーポリシーは Resend への委託と認証・制限情報、特商法表記は利用開始の条件を更新している。

## Simulator の操作を再実行する

Maestro を使う場合、アプリが未ログインの状態で、まだ登録していないテスト用アドレスを指定する。
メールを読める受信先か、ローカル console モードを使う。

```sh
maestro --device <SimulatorのUDID> test -e EMAIL=<テスト用アドレス> .maestro/email-register.yaml
maestro --device <SimulatorのUDID> test -e OTP=<届いた6桁コード> .maestro/email-verify.yaml
```

2つめは最初のテスト直後の確認画面から実行する。パスワードはテスト専用の `otp-native-password`。
キーボードの初回案内が表示された場合は案内を閉じてから実行する。テスト用コードをリポジトリに保存しない。

## 初回実装の確認記録（2026年9月30日）

- `bun run test`：144件成功（API 119、サーバー11、インフラ14）。既存ストーリーの回帰テストを含む。
- `bun run check-types`、`bunx oxlint`、`bun run check:patterns`：成功。
- stg / prod の `deploy:check`：成功。デプロイそのものは未実施。
- iPhone 17 Pro / iOS 26.4 Simulator：新規登録、6桁コード確認、ホームへの遷移、現在・変更先の両方を確認するアドレス変更、プロフィールへの反映、ログアウト、変更先アドレスでの再ログインを確認。
- Resend のテスト受信先で送信元と `delivered` を確認。一般の受信箱での迷惑メール判定は未確認。

## 標準の回数制限への移行確認（2026年9月30日）

- `bun run test`：144件成功（API 119、サーバー11、インフラ14）。並列リクエストの上限、再起動後の制限維持、時間経過後の解除、拒否された再送後のコード確認を含む。
- `bun run check-types`、`bunx oxlint`、`bun run check:patterns`、変更ファイルのフォーマット確認：成功。
- Alchemy のローカル D1 に移行を適用し、`auth_rate_limit` がなく `rate_limit` があること、既存ユーザーが残ることを確認。本番へのデプロイは未実施。
- iPhone 17 Pro / iOS 26.4 Simulator：ログアウト、新規登録、Resend テスト宛先への配信、6桁コード確認、ホームへの遷移を確認。DB の確認済みフラグと標準テーブルへの回数記録も確認。
- プライバシーポリシーの保存情報を標準方式に合わせて更新。利用開始の条件は変わらないため、利用規約と特商法表記の追加変更は不要。

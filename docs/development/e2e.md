# ブラウザの E2E テスト

`docs/user-stories/` のストーリーを、ブラウザ（Playwright の Chromium）で通しで確かめる。テストは `apps/web/e2e/` にある。

## 前提

- `bun install` を済ませ、`apps/web/.env` に開発用の環境変数を設定する。
  - 認証コードをログから読むため、`AUTH_EMAIL_DELIVERY=console` にする。
  - Stripe には接続しないので、Stripe のキーはテスト用の仮の値（`sk_test_...`、`pk_test_...`、`whsec_...`）でよい。
- Playwright の Chromium を用意する。未導入なら `bunx playwright install chromium` を `apps/web` で実行する。
- 開発サーバーを起動しておく（`bun run dev:server`）。起動していなければ、テストの開始時に Playwright が同じコマンドで起動する。

## 実行

リポジトリのルートで実行する。

```sh
bun run test:e2e
```

特定のファイルだけを実行する場合は、`apps/web` で `bunx playwright test e2e/commitments.spec.ts` のように指定する。

各テストの前に `bun run --cwd packages/db db:seed:e2e`（`packages/db/src/seed/e2e.ts`）を実行し、ローカル D1 を決まった状態にする。

- デモユーザー（demo@ichiro.app / password123）と3件のコミットメントを作り直す。
- パスワード再設定用のユーザーと、登録済みアドレスの確認用ユーザー（otp@ichiro.example）を作り直す。
- 認証の回数制限の記録を消す。続けて実行しても 429 にならないようにするため。

新規登録やメールアドレス変更のテストは、毎回別のメールアドレスを使う。認証コードは、開発サーバーのログ（`packages/infra/.alchemy/log/`）に出る `local-auth-email` から読む。

## テストとストーリーの対応

| ファイル                 | ストーリー                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `onboarding.spec.ts`     | onboarding、sign-up-consent、password-visibility、existing-account-sign-up、brand-appearance              |
| `email.spec.ts`          | verify-email、change-email                                                                                |
| `password-reset.spec.ts` | reset-password、password-visibility                                                                       |
| `commitments.spec.ts`    | commitment-list、create-commitment、edit-commitment、report-achievement、view-penalty-history、self-check |
| `account.spec.ts`        | profile-sheet、upload-profile-photo、contact-support、read-legal-documents、withdrawal                    |
| `payment.spec.ts`        | register-payment-method                                                                                   |
| `public-site.spec.ts`    | view-service-introduction、read-legal-documents                                                           |

commitment-edit-log、penalty-collection、staging-isolation は E2E の対象外。API のテスト（`bun run test`）と、各ストーリーの手動の手順で確かめる。

## Stripe の扱い

`payment.spec.ts` は Stripe に接続しない。`https://js.stripe.com` を偽の Stripe.js（`apps/web/e2e/support/fake-stripe.ts`）に差し替え、Stripe の API を呼ぶ `consumer.payment.startSetup` と `consumer.payment.completeSetup` の応答をテストの中で返す。
確かめるのは、Payment Element のダイアログの表示、キャンセル、カードの拒否、登録完了までの画面の流れ。実際のカード入力と本人認証（3D セキュア）は、Stripe のテスト環境で [支払い方法の登録](../user-stories/register-payment-method.md) の手順に沿って手動で確かめる。

## 並列で作業するとき

worktree ごとに別のポートで開発サーバーを起動し、E2E もそのポートに向ける。ローカルの D1 は worktree ごとに分かれる。

```sh
ICHIRO_DEV_PORT=3001 bun run dev:server
E2E_BASE_URL=http://localhost:3001 bun run test:e2e
```

## 失敗したとき

失敗したテストのトレースは `apps/web/test-results/` に残る。`bunx playwright show-trace <trace.zip>` で、操作と画面の変化を確認できる。

# 検証環境で本番データに影響せず動作確認できる

> ステータス: 環境分離の設定・検証コマンド実装済み。リモート環境の実証には環境別の認証情報とデプロイが必要。

## ストーリー

アプリを検証するユーザーとして、本番データに影響を与えず、登録・画像アップロード・支払いの一連の流れを試したい。

## 動作確認の手順

1. [stg / prod へのデプロイ](../development/deploy.md) に従って stg を設定し、`bun run deploy:check:stg` を実行する。
   - stg に本番 Stripe キーを設定すると、Cloudflare に接続する前にエラーになる。
   - 設定が足りないと開発用 `.env` へフォールバックせずエラーになる。
2. `bun run deploy:stg` を実行する。
   - stg 専用の Worker・D1・R2 が作られる。画面と API は同じ Worker から配信される。
3. ブラウザで stg の Worker の URL を開き、`/app` で新規登録して、目標・画像・テスト用の支払い方法を登録する。
   - 支払い方法の登録には stg の `STRIPE_PUBLISHABLE_KEY`（pk_test_...）が使われる。
   - 必要なら `packages/db/src/seed/run.ts` を stg の D1 に対して実行し、既存ストーリー用のデモデータを作れる。
   - → [新規登録・ログイン](./onboarding.md)、[プロフィール写真](./upload-profile-photo.md)、[支払い方法](./register-payment-method.md)
4. prod を設定・デプロイし、ブラウザで prod の URL（https://ichiro.app）を開く。
   - prod の画面と API は `https://ichiro.app` で応答し、stg の Worker に独自ドメインが割り当てられない。
   - stg のユーザー・セッション・画像・支払い情報が prod に引き継がれない。stg でログインしていても、prod では未ログインになる。
   - prod にテスト用 Stripe キーを設定するとデプロイを拒否する。

## データの持ち方

- Alchemy の stage ごとに Worker・D1・R2 を分離する。
- 認証シークレット、Stripe のキー（シークレットキー・公開可能キー）と Webhook の署名シークレットは環境ごとに管理する。
  - Webhook は各 Worker の URL の `/api/stripe/webhook` に、環境ごとに別のエンドポイントとして作る。
- セッションは Worker ごとの HttpOnly の Cookie に持つので、stg と prod でオリジンが異なり共有されない。
- 既存の seed は検証用 DB のみに投入する。

## 対応するテスト

- `packages/infra/scripts/deployment-settings.test.ts`: stage・秘密情報・環境別ファイルの読み込み。
- `packages/api/src/test/auth.integration.test.ts`: 別 DB・別認証シークレットではセッションを共有しない。
- 全ストーリーの API 回帰確認は `bun run test`。E2E テストはない。Cloudflare の実リソース分離と実際の決済連携はデプロイ後に上記手順でブラウザから確認する。

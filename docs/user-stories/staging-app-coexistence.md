# stg と本番のアプリを同じ端末で使う

> ステータス: 実装済み。実機への配布には stg の再ビルドが必要。

## ストーリー

アプリを検証するユーザーとして、本番のアプリを残したまま stg をインストールし、名前で区別して起動したい。

## 動作確認の手順

1. [ビルド手順](../development/eas-build.md) に従い、本番と preview のアプリをビルドする。
   - 本番は `ichiro`、preview は `[stg] ichiro` になる。
2. 同じ iPhone に両方をインストールし、それぞれ起動する。
   - 後から入れたアプリに置き換えられず、両方が残る。
3. `ichiro://sign-in` と `ichiro-stg://sign-in` を開く。
   - それぞれ本番と stg のネイティブアプリが開く。
4. stg と本番にそれぞれログインする。
   - それぞれの環境に接続し、セッションを共有しない。
   - → [検証環境の分離](./staging-isolation.md)

## データの持ち方

- Bundle ID と Android package を分け、端末上のアプリと保存領域を分離する。
- このストーリー単独では DB データは不要。ログイン以降の検証には `packages/db/src/seed/run.ts` の既存コマンドを検証用 DB に対して利用する。
- 表示名とインストール識別子の変更で、収集情報・料金・契約条件は変わらないため、利用規約・プライバシーポリシー・特定商取引法に基づく表記の改定は不要。

## 対応するテスト

- `packages/api/src/test/auth.integration.test.ts`: 本番と stg の URL スキームによる認証と、不明なスキームの拒否。
- `bun run test`: 既存ストーリーの回帰テスト。
- `.maestro/staging-app-coexistence.yaml`: 両方をインストールした iOS Simulator で、それぞれの起動と URL からログイン画面への遷移を確認する。

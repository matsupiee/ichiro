# EAS Build で stg 用アプリを実機に配布する

## 前提

iPhone にインストールし、Mac の開発サーバーを起動せずに Cloudflare の stg API を利用するための手順。

stg 用アプリのビルドには `--profile preview` を指定する。接続先の `stg` は、preview プロファイル内の `APP_ENV` で選ばれる。

- Expo アカウントと、対象の Expo プロジェクトへのアクセス権がある。
- Apple Developer Program に加入し、署名に使う Apple チームへアクセスできる。
- [Cloudflare の stg デプロイ](./cloudflare-environments.md)が完了している。
- stg 用の Worker URL と、そのサーバーと同じ Stripe テスト環境の公開可能キー `pk_test_...` がある。

現在の `apps/native/app.json` は EAS プロジェクトに連携済み。通常は `eas init` や `eas build:configure` を実行し直す必要はない。

以下のコマンドは、リポジトリのルートから一度 `cd apps/native` したあとに実行する。

```bash
cd apps/native
npx eas-cli@latest login
npx eas-cli@latest whoami
```

## preview プロファイルを使う

`apps/native/eas.json` の既存の `build.preview` を使用する。別名の `stg` プロファイルは作らない。

```json
"preview": {
  "distribution": "internal",
  "environment": "preview",
  "env": {
    "APP_ENV": "stg",
    "EXPO_NO_DOTENV": "1"
  },
  "ios": {
    "simulator": false
  }
}
```

これは `build` 内の抜粋。現在のファイルには設定済み。

| 設定 | 役割 |
| --- | --- |
| `--profile preview` | EAS のビルド設定 `build.preview` を選ぶ |
| `distribution: internal` | 登録した実機へ内部配布する |
| `environment: preview` | EAS 上の preview 環境変数をビルドに渡す |
| `APP_ENV: stg` | Varlock がアプリの stg 設定を選ぶ |
| `EXPO_NO_DOTENV: 1` | Expo による `.env` の自動読み込みを止める |
| `ios.simulator: false` | Simulator 用ではなく iPhone 実機用にビルドする |

`EXPO_NO_DOTENV` は Expo 側の読み込みだけを止める。このプロジェクトでは Varlock が環境変数を管理しており、Expo が先に開発用 `.env` の値を process.env に入れると、stg 用の設定より優先される可能性があるため指定する。Varlock のファイル読み込みと、EAS から渡される環境変数は引き続き利用できる。

`development` プロファイルは開発クライアント用。この手順では、JavaScript を組み込んで単独で起動できる `preview` を使う。

## EAS の環境変数を設定する

[Expo ダッシュボード](https://expo.dev/)で対象プロジェクトの Environment variables を開き、preview 環境に次の値を登録する。

| 名前 | 値 | Visibility |
| --- | --- | --- |
| `EXPO_PUBLIC_SERVER_URL` | stg Worker の HTTPS URL | Plain text |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | stg サーバーと同じ Stripe テスト環境の `pk_test_...` | Plain text |

これらはアプリに組み込まれる公開値。サーバー用の `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`BETTER_AUTH_SECRET` はアプリに渡さない。

ローカルの `.env.stg.local` は Git 管理外なので、クラウドビルドに送られる前提にしない。EAS から渡される値は Varlock の設定ファイルより優先されるため、Git 管理している `.env.stg` の空文字を上書きする。

API の URL や公開キーを変えた場合は、この手順では再ビルド・再インストールして反映する。

## iPhone を登録する

ビルド前に、インストールする iPhone を登録する。

```bash
npx eas-cli@latest device:create
```

表示された URL または QR コードを対象の iPhone で開き、案内に従って端末の UDID を登録する。Expo への登録後、ビルド時にその端末を含む Apple の Provisioning Profile を作成する。

端末を追加した場合、過去のビルドをそのままインストールできるとは限らない。追加端末を含めて再ビルドするか、`eas build:resign` で既存ビルドを再署名する。

## ビルドしてインストールする

```bash
npx eas-cli@latest build --platform ios --profile preview
```

初回は案内に従って Apple アカウント・チームを選び、配布用証明書と Provisioning Profile の作成・選択を進める。インストールしたい端末が対象に含まれていることを確認する。

ビルド完了後、表示されたインストール URL または QR コードを登録済みの iPhone で開いてインストールする。端末で求められた場合はデベロッパモードを有効にする。

これは内部配布であり、TestFlight や App Store への提出ではない。現在は stg / prod で Bundle ID が共通なので、同じ端末に両方を並べるには、事前に Bundle ID とアプリ名を環境別にする設定が必要。

## 動作確認

1. Mac の Expo 開発サーバーを停止した状態で、実機のアプリを開く。
   - アプリが単独で起動する。
2. stg 専用のユーザーで登録・ログインする。
   - Cloudflare の stg Worker にリクエストが届き、stg の D1 にデータが作られる。
3. コミットメントの一覧・作成と、プロフィール写真のアップロードを確認する。
   - データと画像が stg の D1・R2 に保存される。
4. Stripe のテスト用支払い方法を登録する。
   - 同じ Stripe テスト環境で処理され、stg の Webhook にイベントが届く。

## ビルドに失敗した場合

### Missing build profile in eas.json: "stg"

`--profile` には `eas.json` の `build` 内のキーを指定する。このプロジェクトには `development`・`preview`・`production` があり、`stg` というプロファイルはない。

次のコマンドで再実行する。

```bash
npx eas-cli@latest build --platform ios --profile preview
```

`preview` 内の `APP_ENV=stg` によって stg の設定が選ばれるので、このエラーの解消にプロファイルの追加は必要ない。

### 設定不足・インストール失敗

設定が足りずビルドに失敗した場合は、EAS の preview 環境に2つの公開変数があることを確認する。実機にインストールできない場合は、その iPhone がビルドの Provisioning Profile に含まれているか確認する。

## 参考

- [EAS Build の設定](https://docs.expo.dev/build/eas-json/)
- [EAS の環境変数](https://docs.expo.dev/eas/environment-variables/)
- [iOS の内部配布](https://docs.expo.dev/build/internal-distribution/)
- [Expo の環境変数と EXPO_NO_DOTENV](https://docs.expo.dev/guides/environment-variables/)

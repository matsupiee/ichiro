# EAS Build で iOS アプリをビルド・アップロードする

## App Store Connect へのアップロード

以下はリポジトリのルートから実行する。Expo と Apple Developer の認証を求められたら、対象プロジェクト・Apple チームのアカウントでログインする。

### ビルド済みのアプリをアップロードする

```bash
bun run ios:submit
```

案内に従って EAS のビルドを選ぶ。iOS・production・App Store 配布用で、アップロードしたいバージョンとビルド番号のものを選択する。preview は内部配布用なので選ばない。

ビルド ID がわかっている場合は、対象を直接指定できる。

```bash
bun run ios:submit --id 7bb62ce5-9719-411d-ac30-92baa55a62b8
```

この ID は 2026年10月3日に作成した 1.0.0（3）。次回以降は EAS のビルド詳細に表示される ID に置き換える。

### 次回のビルドからアップロードまでまとめて実行する

```bash
bun run ios:release
```

production プロファイルで iOS をビルドし、成功したビルドを App Store Connect に自動アップロードする。ビルド番号は EAS が自動で増やす。API は本番、Stripe は本番の公開可能キーを使用する。

ビルドだけ実行する場合は次を使う。

```bash
bun run ios:build
```

### 初回設定と確認

- EAS の production 環境に `EXPO_PUBLIC_SERVER_URL=https://ichiro.app` と本番用 `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` を設定する。
- App Store Connect に `com.anonymous.ichiro` のアプリを用意する。初回の EAS Submit では Apple の認証やアップロード用認証情報の設定が必要になる場合がある。
- アプリの選択を省略したい場合は、`apps/native/eas.json` の `submit.production.ios.ascAppId` に、App Store Connect の「アプリ情報」にある数字の Apple ID を設定する。Bundle ID や Apple アカウントのメールアドレスとは異なる。
- ビルド前に `bun run test` と `bun run check-types` を実行し、iOS Simulator または実機で動作確認する。
- アップロード完了後は Apple 側の処理を待ち、App Store Connect の TestFlight に対象バージョン・ビルド番号が表示されることを確認する。
- 審査提出画面でそのビルドを選び、スクリーンショット・説明・審査情報を揃えて審査へ提出する。上記コマンドはアップロードまでを行い、App Review への提出や一般公開は行わない。

コマンドの引数だけ確認する場合は `bun run ios:submit --help`、`bun run ios:build --help`、`bun run ios:release --help` を使う。ヘルプ表示ではビルド・アップロードは開始しない。

参考: [EAS Submit の iOS 手順](https://docs.expo.dev/submit/ios/)、[ビルド後の自動アップロード](https://docs.expo.dev/build/automate-submissions/)。

## stg 用アプリの内部配布

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

| 設定                     | 役割                                           |
| ------------------------ | ---------------------------------------------- |
| `--profile preview`      | EAS のビルド設定 `build.preview` を選ぶ        |
| `distribution: internal` | 登録した実機へ内部配布する                     |
| `environment: preview`   | EAS 上の preview 環境変数をビルドに渡す        |
| `APP_ENV: stg`           | Varlock がアプリの stg 設定を選ぶ              |
| `EXPO_NO_DOTENV: 1`      | Expo による `.env` の自動読み込みを止める      |
| `ios.simulator: false`   | Simulator 用ではなく iPhone 実機用にビルドする |

`EXPO_NO_DOTENV` は Expo 側の読み込みだけを止める。このプロジェクトでは Varlock が環境変数を管理しており、Expo が先に開発用 `.env` の値を process.env に入れると、stg 用の設定より優先される可能性があるため指定する。Varlock のファイル読み込みと、EAS から渡される環境変数は引き続き利用できる。

`development` プロファイルは開発クライアント用。この手順では、JavaScript を組み込んで単独で起動できる `preview` を使う。

## EAS の環境変数を設定する

[Expo ダッシュボード](https://expo.dev/)で対象プロジェクトの Environment variables を開き、preview 環境に次の値を登録する。

| 名前                                 | 値                                                   | Visibility |
| ------------------------------------ | ---------------------------------------------------- | ---------- |
| `EXPO_PUBLIC_SERVER_URL`             | stg Worker の HTTPS URL                              | Plain text |
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

これは内部配布であり、TestFlight や App Store への提出ではない。`app.config.ts` が `APP_ENV=stg` の場合だけ表示名・識別子・URL スキームを切り替える。

| 設定                            | stg（preview）             | 本番（production）     |
| ------------------------------- | -------------------------- | ---------------------- |
| 表示名                          | `[stg] ichiro`             | `ichiro`               |
| iOS Bundle ID / Android package | `com.anonymous.ichiro.stg` | `com.anonymous.ichiro` |
| URL スキーム                    | `ichiro-stg`               | `ichiro`               |

本番の TestFlight アプリと同じ端末にインストールできる。旧 stg ビルドは本番と同じ識別子なので、上記のコマンドで再ビルドして新しい stg をインストールする。初回は stg の識別子用の Provisioning Profile が必要になる。別アプリになるため、旧アプリのログイン状態は引き継がれない。

stg の認証リクエストでは `ichiro-stg://` を使用するため、新しいアプリを配布する前に、このスキームを許可した API を stg にデプロイする。

ローカルで既存の `ios/` を再利用する場合は、`APP_ENV=stg EXPO_NO_DOTENV=1 bunx expo prebuild --platform ios --no-install` で設定を反映してからビルドする。本番に戻すときも `APP_ENV=prod` で再生成する。

参考: [Expo のアプリバリアント](https://docs.expo.dev/build-reference/variants/)。

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

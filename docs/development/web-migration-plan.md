# Web 版への移行計画

ネイティブアプリ（`apps/native`）を廃止し、TanStack Start で作る Web アプリ（`apps/web`）に置き換える。
画面と API は1つの Cloudflare Worker から同一オリジンで配信する。App Store には提出しない。

## 目指す構成

### ディレクトリ

```
apps/web/
├─ src/
│  ├─ routes/                  画面とサーバールート（ファイルベース）
│  │  ├─ __root.tsx
│  │  ├─ index.tsx             紹介ページ（未ログイン）。ログイン済みなら /app へリダイレクト
│  │  ├─ terms.tsx / privacy.tsx / commerce.tsx
│  │  ├─ app/...               ログイン後の画面
│  │  ├─ api/auth/$.ts         better-auth のハンドラ
│  │  ├─ api/trpc/$.ts         tRPC（packages/api の appRouter をマウント）
│  │  ├─ api/stripe/webhook.ts
│  │  └─ avatars/$.ts          プロフィール写真（R2）
│  ├─ server/                  サーバー専用のコード（現在の apps/server/src の中身）
│  ├─ server.ts                Worker のエントリ（fetch と scheduled）
│  ├─ components/ / lib/
│  └─ router.tsx
├─ public/                     フォント・画像（現在の apps/server/public）
└─ vite.config.ts              tanstackStart() と @cloudflare/vite-plugin

packages/api      tRPC ルーターとビジネスロジック
packages/auth     better-auth の設定
packages/config
packages/db
packages/infra    Alchemy（Worker の main と assets を apps/web のビルド出力に向ける）
```

`apps/server` と `apps/native` は削除する。Hono は使わず、ルーティングは Start のサーバールートで行う。

### URL

| URL                             | 未ログイン       | ログイン済み          |
| ------------------------------- | ---------------- | --------------------- |
| `/`                             | 紹介ページ       | `/app` へリダイレクト |
| `/app/*`                        | ログイン画面へ   | アプリ本体            |
| `/terms` `/privacy` `/commerce` | 規約を表示       | 規約を表示            |
| `/api/auth/*`                   | better-auth      | better-auth           |
| `/api/trpc/*`                   | tRPC             | tRPC                  |
| `/api/stripe/webhook`           | Stripe Webhook   | Stripe Webhook        |
| `/avatars/*`                    | プロフィール写真 | プロフィール写真      |

紹介ページは `/` に置く。`ichiro.app` を開いた初めての人に紹介ページを見せ、Stripe の審査や検索結果にもサービス内容が出るようにするため。
ログイン済みかどうかは `/` の `beforeLoad` でセッションを確認して判定する。

Stripe の Webhook の URL が `/stripe/webhook` から `/api/stripe/webhook` に変わる。stg と prod の Stripe ダッシュボードの設定も合わせて変更する。

### Worker のエントリ

Start が用意するエントリ（`@tanstack/react-start/server-entry`）は `fetch` しか持たない。
罰金精算の cron を動かすため、`src/server.ts` で Start のハンドラを `fetch` に、`runPenaltyJob` を `scheduled` に割り当て、Worker の `main` をこのファイルに向ける。

```ts
import handler from "@tanstack/react-start/server-entry";

export default {
  fetch: handler.fetch,
  scheduled(controller, _env, ctx) {
    ctx.waitUntil(runPenaltyJob(getDb(), getStripe(), new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
```

正確な書き方は、実装前に Cloudflare と TanStack Start の公式ドキュメントで確認する。

## フェーズ

### Phase 1: 土台（完了）

1. Alchemy の `Cloudflare.Website.Vite` で、TanStack Start を Worker としてビルド・配信する。
   - Alchemy が開発・ビルド時に Cloudflare の Vite プラグインを差し込むので、`apps/web/vite.config.ts` には Cloudflare のプラグインを書かない。
   - `main` に `src/server.ts` を指定し、`fetch` を Start に、`scheduled` を罰金精算に割り当てる。
2. `apps/server` を `apps/web` に移し、サーバー専用のコードは `apps/web/src/server/` に置く。
3. 紹介ページと規約ページは、JS を含まない今の HTML（`public-page.ts`）をサーバールートから返す。
   - React で描画するとハイドレーション用のスクリプトが入り、今の CSP を保てないため。
4. tRPC、better-auth、Stripe Webhook、アバターの各ルートをサーバールートに移す。
   - tRPC は `/api/trpc/*` に移す。ネイティブアプリの接続先も合わせて変えた。
   - アバターのルートは `packages/api/src/http.ts` の Hono アプリをそのまま使い、サーバールートから Request を渡す。Hono は `packages/api` と紹介ページの中だけに残る。
5. `/app` は Phase 2 で画面を作るまでの仮の入口にする。

### Phase 2: 認証

- `packages/auth` から `@better-auth/expo` を外し、`tanstackStartCookies` を追加する。
- `trustedOrigins` から `ichiro://`、`ichiro-stg://`、`exp://`、`http://localhost:8081` を削除し、自分のオリジンだけにする。
- Cookie の `sameSite` を `none` から `lax` にする。
- 新規登録、ログイン、メール確認、パスワード再設定、メールアドレス変更、退会の画面を作る。

### Phase 3: 画面の移植

| 現状（ネイティブ）                          | Web での置き換え                                       |
| ------------------------------------------- | ------------------------------------------------------ |
| expo-router                                 | TanStack Router（Start のルート）                      |
| heroui-native と uniwind                    | Tailwind v4 と自前コンポーネント（必要に応じて Radix） |
| @gorhom/bottom-sheet                        | ダイアログまたはドロワー                               |
| react-native-reanimated                     | CSS アニメーションまたは Motion                        |
| react-native-svg                            | SVG                                                    |
| expo-image-picker と expo-image-manipulator | `<input type="file">` と Canvas での縮小               |
| @react-native-community/datetimepicker      | `<input type="date">`                                  |
| expo-haptics                                | 削除                                                   |
| アプリアイコンの変更（modules/app-icon）    | 機能ごと削除                                           |

tRPC の呼び出し、日付の計算、エラーメッセージなど、React Native に依存しないロジックは流用する。

### Phase 4: 決済

- Stripe の PaymentSheet を、Stripe.js の Payment Element による SetupIntent の確定に置き換える。
- `payment/start-setup` は ephemeral key を作らず、`setupIntentClientSecret` だけを返す。統合テストも合わせて直す。
- 登録できる支払い方法はカードだけにする。Apple Pay と Google Pay は使わないので、Stripe でのドメイン登録は不要。
- 3D セキュアはブラウザ内で完了する。`complete-setup` と Webhook の処理は変えない。
- アプリ画面の CSP で Stripe.js の読み込みを許可する。紹介ページと規約ページの CSP は今の厳しさを保つ。

### Phase 5: ネイティブの削除

Web 版で全ストーリーが通ってから行う。

- `apps/native`、`apps/server`、`.maestro/`、App Store 用のスクリーンショットを削除する。
- ルートの `package.json` から `ios:*` と `dev:native*` を削除し、`dev`、`postinstall`、`env:generate` の対象を `apps/web` に変える。
- 使わなくなった `@better-auth/expo` をカタログから削除し、`bun install` で lockfile を作り直す。
- 同一オリジンになるため、`CORS_ORIGIN` を環境変数と `deployment-settings.ts` の検証から削除する。
- README、`docs/development/eas-build.md`、`docs/development/app-icons.md`、`docs/development/public-site.md` を更新または削除する。

### Phase 6: ドキュメント、規約、テスト

- `AGENTS.md` の「ネイティブ専用」「ブラウザで確認しない」「iOS Simulator で確認する」のルールを、Web 版の方針（Playwright と Chromium で動作確認する）に書き換える。
- `apps/server/src/site/legal.ts` の規約を見直す。
  - 利用規約：「目標管理アプリ」「アプリの削除やログアウト」の表現。
  - プライバシーポリシー：「端末の安全な保存領域」を認証用 Cookie の説明に変える。
  - 特定商取引法に基づく表記：「ネイティブアプリ」「ダウンロード」の表現と、動作環境（iOS 16.4 以降の iPhone）を対応ブラウザに変える。
  - 施行日を更新する。
- `docs/user-stories/` の `change-app-icon.md` と `staging-app-coexistence.md` を削除し、ほかのストーリーは Web の操作に合わせて書き直す。
  - `register-payment-method.md`、`create-commitment.md`、`profile-sheet.md` から Apple Pay の記述を外し、カードだけにする。デモデータの「Apple Pay（Visa •••• 4242）」もカードに変える。
- Maestro のフローを Playwright に移し、全ストーリーを通しで確認する。seed は `packages/db/src/seed/` のものを使う。

## ローカルでの起動

`bun run dev:server` で `http://localhost:3000` に画面と API が立ち上がる。`apps/web/.env` に環境変数を設定する。

`alchemy dev` はローカル実行でも Cloudflare の認証情報を要求する。認証情報を置けない環境（クラウドの開発環境など）では、ダミーの値で起動できる。ローカル実行では Cloudflare の API を呼ばない。

```sh
CI=1 CLOUDFLARE_ACCOUNT_ID=00000000000000000000000000000000 CLOUDFLARE_API_TOKEN=dummy bun run dev:server
```

cron の処理は `curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=5+*+*+*+*"` で呼び出せる。

## 決定事項

- Apple Pay と Google Pay は使わない。支払い方法はカードだけにする。
- PWA には対応しない。
- 移行が必要な既存ユーザーはいない前提で進める。ネイティブ版のデータ移行や併存期間は設けない。

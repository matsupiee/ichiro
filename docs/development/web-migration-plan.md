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

| URL | 未ログイン | ログイン済み |
|---|---|---|
| `/` | 紹介ページ | `/app` へリダイレクト |
| `/app/*` | ログイン画面へ | アプリ本体 |
| `/terms` `/privacy` `/commerce` | 規約を表示 | 規約を表示 |
| `/api/auth/*` | better-auth | better-auth |
| `/api/trpc/*` | tRPC | tRPC |
| `/api/stripe/webhook` | Stripe Webhook | Stripe Webhook |
| `/avatars/*` | プロフィール写真 | プロフィール写真 |

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

### Phase 1: 土台

1. Alchemy で TanStack Start のビルド出力を Worker としてデプロイできるかを検証する。
   - 難しい場合は、ビルド後の Worker を Alchemy の `main` と `assets` に渡すか、デプロイだけ wrangler に寄せる（D1 と R2 の作成は Alchemy に残す）。
2. `apps/web` を作成し、`src/server.ts` で `fetch` と `scheduled` を動かす。
3. 紹介ページと規約ページを Start のルートに移植する。
   - `apps/server/src/public-page.test.ts` の確認内容を移す。
4. tRPC、better-auth、Stripe Webhook、アバター配信をサーバールートに移す。
   - `packages/api/src/http.ts`（Hono 前提の `createHttpApp`）はサーバールート向けに書き直す。

### Phase 2: 認証

- `packages/auth` から `@better-auth/expo` を外し、`tanstackStartCookies` を追加する。
- `trustedOrigins` から `ichiro://`、`ichiro-stg://`、`exp://`、`http://localhost:8081` を削除し、自分のオリジンだけにする。
- Cookie の `sameSite` を `none` から `lax` にする。
- 新規登録、ログイン、メール確認、パスワード再設定、メールアドレス変更、退会の画面を作る。

### Phase 3: 画面の移植

| 現状（ネイティブ） | Web での置き換え |
|---|---|
| expo-router | TanStack Router（Start のルート） |
| heroui-native と uniwind | Tailwind v4 と自前コンポーネント（必要に応じて Radix） |
| @gorhom/bottom-sheet | ダイアログまたはドロワー |
| react-native-reanimated | CSS アニメーションまたは Motion |
| react-native-svg | SVG |
| expo-image-picker と expo-image-manipulator | `<input type="file">` と Canvas での縮小 |
| @react-native-community/datetimepicker | `<input type="date">` |
| expo-haptics | 削除 |
| アプリアイコンの変更（modules/app-icon） | 機能ごと削除 |

tRPC の呼び出し、日付の計算、エラーメッセージなど、React Native に依存しないロジックは流用する。

### Phase 4: 決済

- Stripe の PaymentSheet を、Stripe.js の Payment Element による SetupIntent の確定に置き換える。
- `payment/start-setup` は ephemeral key を作らず、`setupIntentClientSecret` だけを返す。統合テストも合わせて直す。
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
- Maestro のフローを Playwright に移し、全ストーリーを通しで確認する。seed は `packages/db/src/seed/` のものを使う。

## 未決定の事項

- Web で Apple Pay と Google Pay を使うか。使う場合は Stripe でドメインを登録する。
- ホーム画面に追加できるよう PWA に対応するか。
- 移行が必要な既存ユーザーがいないこと（規約上は公開準備中）。

# 紹介ページと規約の編集

## 配信

`apps/web`（TanStack Start）のサーバールート（`apps/web/src/routes/index.ts`、`terms.ts`、`privacy.ts`、`commerce.ts`）が、`apps/web/src/server/public-page.ts` の HTML を返す。
JS を含まない HTML のまま配信し、`script-src` を許可しない厳しい CSP を保つ。ログイン済みで `/` を開いた場合は `/app` へリダイレクトする。
`apps/web/public/` の画像・CSS・フォントは、同じ Worker の Static Assets から配信する。

`bun run dev:server` でローカル起動し、`curl -i http://localhost:3000/` で応答を確認する。

## 規約

本文は `apps/web/src/server/site/legal.ts`。利用規約・プライバシーポリシー・特定商取引法に基づく表記をそれぞれ独立した URL に出す。
各文書の施行日は2026年10月7日と表示する。草案・未施行・公開準備中の案内は削除済み。紹介ページと同じく検索対象に含める。

事業者名、運営責任者、所在地・電話番号の開示方法、問い合わせメール、基本利用料、追加費用、返金・キャンセル条件、退会手順、個人情報の保存期間、国外での取り扱い、対応ブラウザは `legal.ts` に反映済み。
Stripe の登録内容や運用を変えたときは、`legal.ts` も合わせて直す。

## 検索と共有

紹介ページと規約は `noindex` を付けず、`<link rel="canonical">` と OGP（`og:*`、`twitter:card`）を出力する。URL は `public-page.ts` の `SITE_URL`（`https://ichiro.app`）から作る。
共有用画像は `apps/web/public/images/og.png`（1200×630）。紹介ページの画面の画像を差し替えたら、これも作り直す。

`/robots.txt` は、リクエストのオリジンが `SITE_URL` のときだけ巡回を許可し、サイトマップを案内する。stg の Worker の URL や開発環境では `Disallow: /` を返す。`/sitemap.xml` は紹介ページと3つの規約を載せる。

本番公開後に次を手作業で行う。

1. Google Search Console に `https://ichiro.app` を登録する。DNS は Cloudflare にあるので、ドメインプロパティの TXT レコードで所有権を確認できる。
2. サイトマップ `https://ichiro.app/sitemap.xml` を送信する。
3. X の投稿画面や Facebook のシェアデバッガーで、https://ichiro.app/ のカードを確かめる。

本文作成時に参照した一次情報：

- [Stripe の商取引に関する開示ガイド](https://support.stripe.com/questions/how-to-create-and-display-a-commerce-disclosure-page?locale=ja-JP)
- [消費者庁の通信販売広告の表示事項](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php)
- [個人情報保護委員会の通則編ガイドライン](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)
- [消費者庁の消費者契約法の案内](https://www.caa.go.jp/policies/policy/consumer_system/consumer_contract_act/index.html)

## 画像の差し替え

撮影用 seed と操作手順は [サービス紹介のストーリー](../user-stories/view-service-introduction.md)を参照する。
今の画像は Web 版へ移行する前のネイティブアプリの画面を撮影したもの。差し替えるときは、Web 版の画面をスマートフォンの幅で撮影する。個人情報や既存のテストユーザーの内容を含めない。
`apps/web/public/images/` の画像を差し替える。今のスクリーンショットの元サイズは1206×2622。

ロゴは筆記体の `apps/web/public/images/ichiro-wordmark.png`。紹介ページはこの画像をそのまま表示し、アプリの `BrandLogo`（`apps/web/src/components/ui.tsx`）はこの画像をマスクにして水色で塗る。差し替えると両方に反映される。

## 検証

`bun run test`、`bun run check-types` を実行する。HTTP テスト（`apps/web/src/server/public-page.test.ts`）は公開ページ、規約ページ、画像の存在、既存 API のパスとの共存を検証する。
`bun run test:e2e` の `apps/web/e2e/public-site.spec.ts` は、ブラウザで紹介ページと規約ページを開いて確かめる。手順は [E2E テスト](./e2e.md)を参照する。
撮影用アカウントでは http://localhost:3000/app にログインし、一覧・詳細・達成報告を確認する。

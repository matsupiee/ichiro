# 紹介ページと規約の編集

## 配信

`apps/web`（TanStack Start）のサーバールート（`apps/web/src/routes/index.ts`、`terms.ts`、`privacy.ts`、`commerce.ts`）が、`apps/web/src/server/public-page.ts` の HTML を返す。
JS を含まない HTML のまま配信し、`script-src` を許可しない厳しい CSP を保つ。ログイン済みで `/` を開いた場合は `/app` へリダイレクトする。
`apps/web/public/` の画像・CSS・フォントは、同じ Worker の Static Assets から配信する。

`bun run dev:server` でローカル起動し、`curl -i http://localhost:3000/` で応答を確認する。

## 規約

本文は `apps/web/src/server/site/legal.ts`。利用規約・プライバシーポリシー・特定商取引法に基づく表記をそれぞれ独立した URL に出す。
各文書の施行日は2026年9月30日と表示する。草案・未施行の案内は削除済み。検索対象には含めない。

正式公開前に、Stripe の登録と一致する事業者名、運営責任者、住所、電話番号・受付時間、問い合わせメールを反映する。
基本利用料、税の表示、追加費用、利用者都合の返金条件・申請期限・処理期間、退会手順、個人情報の保存期間、国外での取り扱い、対象 OS も確認する。
実装と運用に合わせて本文を見直したうえで、検索対象に含める際は `noindex` を外す。アプリ側の同意取得や規約リンクの接続は、この紹介ページの実装には含まない。

本文作成時に参照した一次情報：

- [Stripe の商取引に関する開示ガイド](https://support.stripe.com/questions/how-to-create-and-display-a-commerce-disclosure-page?locale=ja-JP)
- [消費者庁の通信販売広告の表示事項](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php)
- [個人情報保護委員会の通則編ガイドライン](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)
- [消費者庁の消費者契約法の案内](https://www.caa.go.jp/policies/policy/consumer_system/consumer_contract_act/index.html)

## 画像の差し替え

撮影用 seed と操作手順は [サービス紹介のストーリー](../user-stories/view-service-introduction.md)を参照する。
画像はネイティブの画面を撮影したもので、個人情報や既存のテストユーザーの内容を含めない。
`apps/web/public/images/` の画像を差し替える。スクリーンショットの元サイズは1206×2622。

ロゴはアプリアイコンと同じ筆記体を使う。`apps/native/assets/images/ichiro-wordmark.png` を `apps/web/public/images/ichiro-wordmark.png` にコピーし、アプリ内と同じ画像を配信する。

## 検証

`bun run test`、`bun run check-types` を実行する。HTTP テストは公開ページ、規約ページ、画像の存在、既存 API のパスとの共存を検証する。
ネイティブでは撮影用アカウントでログインし、一覧・詳細・達成報告を確認する。

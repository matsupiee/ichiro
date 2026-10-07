# アプリのサービス内容をログインせず確認できる

> ステータス: 紹介ページと規約類を実装済み。施行日は2026年10月7日。本文の一部の運用条件の確定、本番公開は未完了。

## ストーリー

アプリの利用を検討している人として、サービスの内容と請求の仕組みをログインせずに確認したい。
アカウントを作る前に、何ができて、どのような場合に支払いが発生するか知りたいから。

## 動作確認の手順

1. リポジトリのルートで `bun run dev:server` を起動し、`curl -i http://localhost:3000/` で取得する。
   - 認証なしで HTTP 200 と日本語の HTML が返る。JavaScript は含まない。
   - サービスの説明、公開準備中の表示、規約類へのリンクが含まれる。説明は Web アプリとしての内容になっている。
   - 一覧・罰金設定・達成記録・お祝いの画像が含まれる。`/images/commitments.png`、`/images/penalty.png`、`/images/progress.png`、`/images/celebration.png` を取得できる。
   - 画像は Web 版へ移行する前のネイティブアプリの画面を撮影した既存のもの。HTML の画像サイズが PNG の実寸に一致する。
   - フッターの利用規約・プライバシーポリシー・特定商取引法に基づく表記のリンク先（`/terms`・`/privacy`・`/commerce`）を取得できる。
   - 各文書に「施行日：2026年10月7日」が表示され、草案・未施行の案内は表示されない。
2. ログインしていないブラウザで http://localhost:3000/ を開く。
   - アプリと同じ水色を基調に、使い方を画像・STEP 1〜3・短い見出しの順で案内する。スマートフォンの幅では縦1列、広い画面では横3列になる。
   - STEP 1「やることを決めよう」、STEP 2「罰金を設定」、STEP 3「できたら報告」の順で表示される。
   - 独立した料金説明セクションと、そのナビゲーションは表示されない。請求条件はフッターの特定商取引法に基づく表記から確認できる。
   - ロゴはアプリ内と同じ筆記体の画像（`ichiro-wordmark.png`）を使う。
   - → [アプリ内で利用条件と個人情報の取り扱いを確認できる](./read-legal-documents.md)
3. 同じブラウザで http://localhost:3000/app を開いてログインし、もう一度 http://localhost:3000/ を開く。
   - 紹介ページではなく、アプリのホーム（`/app`）にリダイレクトされる。
   - ログインとコミットメント一覧が引き続き使える。
   - → [メインページでコミットメントを一覧できる](./commitment-list.md)
4. `bun run test` で既存 API と紹介ページのテストを実行する。
   - API のパス（`/api/...`）は紹介ページに置き換わらない。
5. 紹介ページの画像を Web 版の画面に差し替えるときは、撮影用データを作ってブラウザで撮影する。
   - `bun run --cwd packages/db db:seed:public-page --url file:/絶対パス/対象.sqlite --skip-migrations` で、開発サーバーのローカル D1 に撮影用データを入れる。リモート DB は指定できない。
   - ブラウザで `screenshots@ichiro.example` / `screenshot-demo-only` でログインする。日付は実行日の現地日付になる。
   - スマートフォンの幅で一覧を撮影し、「毎朝、本を10ページ読む」の詳細を撮影する。「今日の達成を報告する」を押すと、7日連続達成のお祝い画面を撮影できる。
   - 罰金設定の画像は撮影用目標の詳細で下にスクロールし、「罰金を設定する」をオンにして撮影する。撮影後は保存せず戻り、撮影用目標に請求設定を残さない。
   - 撮影用データは既存のデモユーザーを変更せず、専用アカウントと罰金なしの目標3件を作る。
   - → [紹介ページと規約の編集](../development/public-site.md)

## データの持ち方

- `apps/web/src/server/public-page.ts` に公開紹介文を持つ。
  - `apps/web/src/routes/index.ts`・`terms.ts`・`privacy.ts`・`commerce.ts` のサーバールートがこの HTML を返す。`/` だけはログイン済みなら `/app` へリダイレクトする。
  - 紹介文と規約の HTML は DB を使わずに作る。`/` ではログイン状態だけを確かめる。規約本文は `apps/web/src/server/site/legal.ts` に持つ。
  - 画像と CSS は `apps/web/public/` から Workers の Static Assets で配信する。ロゴはアプリ内と同じ `ichiro-wordmark.png` を配信する。
  - 撮影用データは `packages/db/src/seed/public-page.ts` に持つ。
  - 公開前に Stripe 登録と一致する運営者名、問い合わせ先、返金・キャンセル条件などを確定して反映する。

## 対応するテスト

- `apps/web/e2e/public-site.spec.ts`：未ログインでの紹介ページ（JavaScript を含まないこと、画像の読み込み）、フッターから開く規約、API のパスが紹介ページに置き換わらないこと。
- ログイン済みで `/` を開いたときのリダイレクトは、手順3でブラウザから確認する。
- `apps/web/src/server/public-page.test.ts`
- `packages/api/src/test/public-page-seed.integration.test.ts`
- 既存ストーリーの回帰確認は `bun run test` と `bun run test:e2e` で実行する。

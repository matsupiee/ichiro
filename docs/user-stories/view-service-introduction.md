# アプリのサービス内容をログインせず確認できる

> ステータス: 紹介ページと規約類を実装済み。紹介ページからアプリのはじめにの画面へ進むボタンを設置済み。施行日は2026年10月7日。運営者情報と請求・返金の条件は `apps/web/src/server/site/legal.ts` に確定済み。検索エンジンと SNS の共有カードに対応済み。Google Search Console への登録は本番公開後に手作業で行う。

## ストーリー

アプリの利用を検討している人として、サービスの内容と請求の仕組みをログインせずに確認したい。
アカウントを作る前に、何ができて、どのような場合に支払いが発生するか知りたいから。

また、SNS で共有されたリンクや検索結果からサービスを見つけたい。リンクに画像と説明が付いていると、どのようなサービスか開く前に分かるから。

## 動作確認の手順

1. リポジトリのルートで `bun run dev:server` を起動し、`curl -i http://localhost:3000/` で取得する。
   - 認証なしで HTTP 200 と日本語の HTML が返る。JavaScript は含まない。
   - サービスの説明と規約類へのリンクが含まれる。説明は Web アプリとしての内容になっている。「公開準備中」の表示はない。
   - `<meta name="description">` に、罰金は任意で100円からであることを含む説明が入る。
   - `noindex` を含まず、`<link rel="canonical">` が `https://ichiro.app/` を指す。
   - 一覧・罰金設定・達成記録・お祝いの画像が含まれる。`/images/commitments.png`、`/images/penalty.png`、`/images/progress.png`、`/images/celebration.png` を取得できる。
   - 画像は Web 版へ移行する前のネイティブアプリの画面を撮影した既存のもの。HTML の画像サイズが PNG の実寸に一致する。
   - フッターの利用規約・プライバシーポリシー・特定商取引法に基づく表記のリンク先（`/terms`・`/privacy`・`/commerce`）を取得できる。
   - 各文書に「施行日：2026年10月7日」が表示され、草案・未施行・公開準備中の案内は表示されない。
   - 規約類も検索の対象にする。`noindex` を含まず、`<link rel="canonical">` がそれぞれ `https://ichiro.app/terms` などを指す。
   - 特定商取引法に基づく表記の「提供時期・利用期間」は、登録とメールアドレスの確認を終えてログインした後すぐに利用できる、という内容になっている。
2. SNS で共有したときのカードを確かめる。
   - `curl -s http://localhost:3000/ | grep -o '<meta property="og:[^>]*>'` で、`og:title`・`og:description`・`og:url`・`og:image` が出る。`og:image` は `https://ichiro.app/images/og.png`。
   - `twitter:card` は `summary_large_image`。X でも大きな画像付きのカードになる。
   - http://localhost:3000/images/og.png を開くと、1200×630 の共有用画像（ロゴ、「続けたいことを、毎日の約束に。」、一覧とお祝いの画面）が表示される。
   - 本番公開後は、X の投稿画面や Facebook のシェアデバッガーに https://ichiro.app/ を入れて、カードの表示を確かめる。
3. 検索エンジン向けのファイルを確かめる。
   - `curl -i http://localhost:3000/robots.txt` で `User-agent: *` と `Disallow: /` が返る。本番以外のドメインは巡回させない。
   - 本番（https://ichiro.app/robots.txt）では `Disallow: /api/` と `Sitemap: https://ichiro.app/sitemap.xml` が返る。
   - `curl -i http://localhost:3000/sitemap.xml` で、`/`・`/terms`・`/privacy`・`/commerce` の本番の URL が XML で返る。
   - 本番公開後に Google Search Console で `https://ichiro.app` を登録し、サイトマップ `https://ichiro.app/sitemap.xml` を送信する。
4. ログインしていないブラウザで http://localhost:3000/ を開く。
   - アプリと同じ水色を基調に、使い方を画像・STEP 1〜3・短い見出しの順で案内する。スマートフォンの幅では縦1列、広い画面では横3列になる。
   - STEP 1「やることを決めよう」、STEP 2「罰金を設定」、STEP 3「できたら報告」の順で表示される。
   - 独立した料金説明セクションと、そのナビゲーションは表示されない。請求条件はフッターの特定商取引法に基づく表記から確認できる。
   - ロゴはアプリ内と同じ筆記体の画像（`ichiro-wordmark.png`）を使う。
   - → [アプリ内で利用条件と個人情報の取り扱いを確認できる](./read-legal-documents.md)
5. 同じブラウザで、紹介ページからアプリを始める。
   - ヘッダーの「はじめる」、最初の画面の「さっそくはじめる」、ページ下部の「アカウントを作ってはじめる」が表示される。規約ページのヘッダーにも「はじめる」がある。
   - 最初の画面とページ下部のボタンの下に「基本利用料は無料。罰金の設定は任意です。」と表示される。特定商取引法に基づく表記の基本利用料と食い違わない。
   - どのボタンを押しても、アプリのはじめにの画面（`/app/welcome`）に移り、「アカウントを作る」「ログイン」を選べる。
   - スマートフォンの幅（390px）でも、ヘッダーのロゴ・「使い方」・「はじめる」が1行に収まる。
   - → [アプリを開いたら新規登録とログインを選べる](./onboarding.md)
6. 同じブラウザで http://localhost:3000/app を開いてログインし、もう一度 http://localhost:3000/ を開く。
   - 紹介ページではなく、アプリのホーム（`/app`）にリダイレクトされる。
   - ログインとコミットメント一覧が引き続き使える。
   - → [メインページでコミットメントを一覧できる](./commitment-list.md)
7. `bun run test` で既存 API と紹介ページのテストを実行する。
   - API のパス（`/api/...`）は紹介ページに置き換わらない。
8. 紹介ページの画像を Web 版の画面に差し替えるときは、撮影用データを作ってブラウザで撮影する。
   - `bun run --cwd packages/db db:seed:public-page --url file:/絶対パス/対象.sqlite --skip-migrations` で、開発サーバーのローカル D1 に撮影用データを入れる。リモート DB は指定できない。
   - ブラウザで `screenshots@ichiro.example` / `screenshot-demo-only` でログインする。日付は実行日の現地日付になる。
   - スマートフォンの幅で一覧を撮影し、「毎朝、本を10ページ読む」の詳細を撮影する。「今日の達成を報告する」を押すと、7日連続達成のお祝い画面を撮影できる。
   - 罰金設定の画像は撮影用目標の詳細で下にスクロールし、「罰金を設定する」をオンにして撮影する。撮影後は保存せず戻り、撮影用目標に請求設定を残さない。
   - 撮影用データは既存のデモユーザーを変更せず、専用アカウントと罰金なしの目標3件を作る。
   - 画面の画像を差し替えたら、共有用画像 `og.png` も新しい画面で作り直す。
   - → [紹介ページと規約の編集](../development/public-site.md)

## データの持ち方

- `apps/web/src/server/public-page.ts` に公開紹介文を持つ。
  - `apps/web/src/routes/index.ts`・`terms.ts`・`privacy.ts`・`commerce.ts` のサーバールートがこの HTML を返す。`/` だけはログイン済みなら `/app` へリダイレクトする。
  - 紹介文と規約の HTML は DB を使わずに作る。`/` ではログイン状態だけを確かめる。規約本文は `apps/web/src/server/site/legal.ts` に持つ。
  - アプリを始めるボタンのリンク先は `APP_START_PATH`（`/app/welcome`）。ログイン済みのユーザーが押した場合は、`/app/_guest` のルートがホームへ送る。
  - 画像と CSS は `apps/web/public/` から Workers の Static Assets で配信する。ロゴはアプリ内と同じ `ichiro-wordmark.png` を配信する。
  - 撮影用データは `packages/db/src/seed/public-page.ts` に持つ。
- 運営者名、運営責任者、問い合わせ先、所在地・電話番号の開示方法、返金・キャンセル条件は `apps/web/src/server/site/legal.ts` に持つ。Stripe に登録した内容と一致させる。
- 検索と共有のための情報も `apps/web/src/server/public-page.ts` に持つ。
  - 正規の URL は本番の `https://ichiro.app`（`SITE_URL`）。stg や開発環境でも、canonical・`og:url`・`og:image` は本番の URL を指す。
  - `/robots.txt` と `/sitemap.xml` はサーバールート（`apps/web/src/routes/robots[.]txt.ts`、`sitemap[.]xml.ts`）が返す。`robots.txt` は、リクエストのオリジンが `SITE_URL` のときだけ巡回を許可する。
  - 共有用画像は `apps/web/public/images/og.png`（1200×630）。
  - アプリの画面（`/app`）は従来どおり `noindex`。

## 対応するテスト

- `apps/web/e2e/public-site.spec.ts`：未ログインでの紹介ページ（JavaScript を含まないこと、画像の読み込み、共有カードの情報）、フッターから開く規約、ヘッダー・最初の画面・ページ下部のボタンからはじめにの画面（`/app/welcome`）へ進めること、`robots.txt` と `sitemap.xml`、API のパスが紹介ページに置き換わらないこと。
- ログイン済みで `/` を開いたときのリダイレクトは、手順6でブラウザから確認する。
- `apps/web/src/server/public-page.test.ts`：公開準備中の表示がないこと、アプリを始めるボタンのリンク先と料金の注記、canonical と OGP、共有用画像のサイズ、本番とそれ以外での `robots.txt` の違い、サイトマップの URL。
- `packages/api/src/test/public-page-seed.integration.test.ts`
- 既存ストーリーの回帰確認は `bun run test` と `bun run test:e2e` で実行する。

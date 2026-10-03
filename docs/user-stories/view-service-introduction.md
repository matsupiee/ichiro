# アプリのサービス内容をログインせず確認できる

> ステータス: 青いアプリに合わせた紹介ページと規約類を実装済み。施行日は2026年9月30日。本文の一部の運用条件の確定、本番公開は未完了。

## ストーリー

アプリの利用を検討している人として、サービスの内容と請求の仕組みをログインせずに確認したい。
アプリをインストールする前に、何ができて、どのような場合に支払いが発生するか知りたいから。

## 動作確認の手順

1. `bun run dev:server` でサーバーを起動し、`curl -i http://localhost:3000/` で取得する。
   - 認証なしで HTTP 200 と日本語の HTML が返る。
   - サービスの説明、公開準備中の表示、規約類へのリンクが含まれる。
   - iOS Simulator で撮影した一覧・罰金設定・達成記録・お祝いの画像が含まれる。`/images/commitments.png`、`/images/penalty.png`、`/images/progress.png`、`/images/celebration.png` を取得できる。
   - お祝い画像は、現在のアプリで使う立体的なワンちゃんと連続達成7日の表示になっている。一覧・達成記録・お祝いは App Store 提出用画像と同じ内容で、HTML の画像サイズが PNG の実寸に一致する。
   - アプリと同じ水色を基調に、使い方を画像・STEP 1〜3・短い見出しの順で案内する。スマートフォン幅では縦1列、広い画面では横3列になる。
   - STEP 1「やることを決めよう」、STEP 2「罰金を設定」、STEP 3「できたら報告」の順で表示される。
   - 独立した料金説明セクションと、そのナビゲーションは表示されない。請求条件はフッターの特定商取引法に基づく表記から確認できる。
   - ロゴはアプリアイコンと同じ筆記体の画像を使う。
   - フッターの利用規約・プライバシーポリシー・特定商取引法に基づく表記のリンク先を取得できる。
   - 各文書に「施行日：2026年9月30日」が表示され、草案・未施行の案内は表示されない。
2. `bun run test` で既存 API と紹介ページのテストを実行する。
   - API のパスは紹介ページに置き換わらない。
3. iOS Simulator でネイティブアプリを起動する。
   - ログインとコミットメント一覧が引き続き使える。
   - アプリの確認にブラウザや Expo Web を使わない。
   - → [コミットメント一覧](./commitment-list.md)

## データの持ち方

- `apps/server/src/public-page.ts` に公開紹介文を持つ。
  - DB と認証への接続は不要。規約本文は `apps/server/src/site/legal.ts` に持つ。
  - 画像と CSS は `apps/server/public/` から Workers の Static Assets で配信する。ロゴはアプリ内と同じ `ichiro-wordmark.png` を配信する。
  - 撮影用データは `packages/db/src/seed/public-page.ts` に持つ。既存のデモユーザーを変更せず、専用アカウントと罰金なしの目標3件を作る。
  - 公開前に Stripe 登録と一致する運営者名、問い合わせ先、返金・キャンセル条件などを確定して反映する。

## 対応するテスト

- `apps/server/src/public-page.test.ts`
- `packages/api/src/test/public-page-seed.integration.test.ts`
- 既存ストーリーの回帰確認は `bun run test` で実行する。

## 撮影用データの作成

```sh
bun run --cwd packages/db db:seed:public-page --url file:/tmp/ichiro-public-page.sqlite
```

Alchemy のローカル D1 に投入する場合は、対象の SQLite ファイルの絶対パスを指定して `--skip-migrations` を付ける。リモート DB は指定できない。
`screenshots@ichiro.example` / `screenshot-demo-only` でネイティブアプリにログインする。日付は実行日の現地日付になる。
一覧を撮影し、「毎朝、本を10ページ読む」の詳細を撮影する。「今日の達成を報告する」を押すと、7日連続達成のお祝い画面を撮影できる。

罰金設定の画像は撮影用目標の詳細で下にスクロールし、「罰金を設定する」をオンにして撮影する。撮影後は保存せず戻り、撮影用目標に請求設定を残さない。

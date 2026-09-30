# アプリのサービス内容をログインせず確認できる

> ステータス: スクリーンショット中心の紹介ページと規約類を実装済み。施行日は2026年9月30日。本文の一部の運用条件の確定、本番公開は未完了。

## ストーリー

アプリの利用を検討している人として、サービスの内容と請求の仕組みをログインせずに確認したい。
アプリをインストールする前に、何ができて、どのような場合に支払いが発生するか知りたいから。

## 動作確認の手順

1. `bun run dev:server` でサーバーを起動し、`curl -i http://localhost:3000/` で取得する。
   - 認証なしで HTTP 200 と日本語の HTML が返る。
   - サービスの説明、公開準備中の表示、罰金の金額・請求条件・決済方法が含まれる。
   - iOS Simulator で撮影した一覧・達成記録・お祝いの画像が含まれる。`/images/commitments.png`、`/images/progress.png`、`/images/celebration.png` を取得できる。
   - 詳細な請求条件は開閉式で表示され、アプリ未公開の表示がある。
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
  - 画像と CSS、ロゴ用フォントは `apps/server/public/` から Workers の Static Assets で配信する。フォントのライセンスも同梱する。
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
一覧を撮影し、「朝の読書」の詳細を撮影する。「今日の達成を報告する」を押して詳細を閉じると、7日連続達成のお祝い画面を撮影できる。

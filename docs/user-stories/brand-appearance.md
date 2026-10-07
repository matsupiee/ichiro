# 水色と筆記体のロゴでアプリを認識できる

> ステータス: 実装済み

## ストーリー

利用者として、参考画像に近い明るい水色と丸みのある筆記体のロゴで、ichiro の画面を一貫して認識したい。

## 動作確認の手順

`bun run db:seed -- --url file:/絶対パス/対象.sqlite --skip-migrations` で移行済みのローカル D1 にデモデータを入れ、`bun run dev:server` を起動する。

1. 未ログインのブラウザで http://localhost:3000/app を開く。
   - ロゴは添付画像をもとにした筆記体と右側の3本の飾り線で表示され、上下が欠けない。
   - 水色 `#3DC4F4` のボタンと淡い青の背景（`#F4FAFD`）が表示される。
   - スマートフォンの幅では1カラムで表示される。PC の広い画面では幅 440px までの列が中央に寄る。
2. 「ログイン」を押し、demo@ichiro.app / password123 でログインする。
   - ホームにも同じ水色のロゴが表示される。
   - 一覧・アカウント・作成・詳細の画面の背景と選択色が青系で統一される。
3. コミットメントを作成し、今日の達成を報告する。
   - 選択状態・達成マーク・作成時のお祝いの光に水色が使われる。達成報告のお祝い画面は白背景になる。
   - 水色のボタンと選択済みの曜日・日の文字は白で表示される。
   - 報告済みの文言は淡い青の背景に濃い青で表示される。
   - お祝いの見出しは Dela Gothic One で表示され、文字が欠けない。
   - → [達成を報告できる](./report-achievement.md)
4. アカウント画面からログアウトする。
   - はじめにの画面に戻り、ロゴとボタンを引き続き表示できる。

## データの持ち方

- 色と寸法は `apps/web/src/styles/app.css` の `@theme` で管理する。値はネイティブ版のときのトークンと同じ。
- ロゴは `apps/web/public/images/ichiro-wordmark.png` の透過画像をマスクにして、水色で塗る。
  - `apps/web/src/components/ui.tsx` の `BrandLogo` で、はじめにの画面とホームに表示する。
  - 画像生成の組み込みツールで、添付画像から文字と3本の飾り線を抽出した素材を使う。
  - 最終プロンプト: "Extract the ichiro wordmark and three rays; preserve original letter silhouettes; solid cyan #3DC4F4 on transparent background; no dog, book, square, shadows or texture."
- お祝いの見出しのフォントは、Dela Gothic One を見出しの文字だけに絞ったサブセット（`apps/web/public/fonts/dela-gothic-one-celebration.woff2`）。
- 新しいデータや API は追加しない。
  - 確認用データは既存の `packages/db/src/seed/run.ts` で作成する。

## 対応するテスト

- `apps/web/e2e/onboarding.spec.ts`：はじめにの画面のロゴとボタンの表示。
- 既存の全ユーザーストーリーに対応する回帰テストは `bun run test` と `bun run test:e2e` で実行する。
- フォント、配色、文字の欠けはブラウザのスクリーンショットで確認する。

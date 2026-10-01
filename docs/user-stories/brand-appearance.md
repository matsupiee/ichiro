# 水色と筆記体のロゴでアプリを認識できる

> ステータス: 実装済み

## ストーリー

利用者として、参考画像に近い明るい水色と丸みのある筆記体のロゴで、ichiro の画面を一貫して認識したい。

## 動作確認の手順

1. iOS Simulator または実機で未ログインのアプリを開く。
   - ロゴは添付画像をもとにした筆記体と右側の3本の飾り線で表示され、上下が欠けない。
   - 水色 `#3DC4F4` のボタンと淡い青の背景が表示される。
2. 「ログイン」を押し、確認用アカウントでログインする。
   - ホームにも同じ水色のロゴが表示される。
   - 一覧・プロフィール・作成・編集画面の背景と選択色が青系で統一される。
3. コミットメントを作成し、今日の達成を報告する。
   - 選択状態・達成マーク・お祝いの光に水色が使われる。
   - 水色のボタンと選択済みの日付・曜日の文字は白で表示される。
   - 報告済みの文言は淡い青の背景に濃い青で表示される。
   - お祝いの日本語は従来の日本語フォントで表示される。
   - → [達成を報告できる](./report-achievement.md)
4. プロフィールからログアウトする。
   - ログイン前の画面に戻り、ロゴとボタンを引き続き表示できる。

## データの持ち方

- 色は `apps/native/lib/theme.ts` と `apps/native/global.css` で管理する。
- ロゴは `apps/native/assets/images/ichiro-wordmark.png` に透過画像として同梱する。
  - `BrandLogo` で開始画面とホームに表示する。
  - 画像生成の組み込みツールで、添付画像から文字と3本の飾り線を抽出し、水色に変更した素材を使う。
  - 最終プロンプト: "Extract the ichiro wordmark and three rays; preserve original letter silhouettes; solid cyan #3DC4F4 on transparent background; no dog, book, square, shadows or texture."
- 新しいデータや API は追加しない。
  - 確認用データは既存の `packages/db/src/seed/run.ts` で作成する。
  - `bun run db:seed -- --url file:/absolute/path/to/local.sqlite --skip-migrations` で移行済みのローカル DB に投入する。
- 機能、料金、個人情報の取り扱いは変わらないため、利用規約・プライバシーポリシー・特商法表記の変更は不要。

## 対応するテスト

- 既存の全ユーザーストーリーに対応する回帰テストは `bun run test` で実行する。
- `.maestro/report-confirmation.yaml` でネイティブの作成・報告・達成表示を確認する。
- フォント、配色、文字の欠けは iOS Simulator のスクリーンショットで確認する。

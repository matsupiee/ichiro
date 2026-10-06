# App Store 用スクリーンショット

## iPhone 6.5インチ枠

1284 × 2778 px を要求する提出枠には `iphone-6.5/` の3枚を使用する。透過なしの sRGB PNG。`iphone-6.9/` のネイティブ画面キャプチャを端末フレームに収め、上部に見出しと説明文を載せている。画面内の UI は描き直していない。

1. `iphone-6.5/01-commitments.png` — 小さな約束。毎日、ちょっとずつ。（目標一覧）
2. `iphone-6.5/02-progress.png` — できたら、タップで報告。（連続達成と今日の報告）
3. `iphone-6.5/03-celebration.png` — 続くと、うれしい。（ワンちゃんのお祝い）

見出しは LP の文言に合わせた。フォントは M PLUS Rounded 1c（SIL Open Font License、Google Fonts）。

再書き出し（リポジトリルートから実行。Playwright と Chromium、フォント取得のためのネットワーク接続が必要）:

```sh
node scripts/render-app-store-screenshots.mjs artifacts/app-store/2026-10-03/iphone-6.9 artifacts/app-store/2026-10-03/iphone-6.5
```

`scripts/prepare-app-store-images.swift --iphone-6.5` は単純な縮小版で `iphone-6.5/` を上書きするため、この枠では使わない。

## iPhone 6.9インチ枠

iPhone 6.9インチ枠用の3枚。1320 × 2868 px、透過なしの sRGB PNG。

1. `iphone-6.9/01-commitments.png` — 毎日の目標一覧
2. `iphone-6.9/02-progress.png` — 連続達成と今日の報告
3. `iphone-6.9/03-celebration.png` — ワンちゃんのお祝いと7日連続達成

既存のネイティブ画面キャプチャを再利用し、提出用に透過チャンネルを除去した。UI の描き直しや生成画像への置き換えは行っていない。LP も同じ3枚を使用する。

仕様: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

再書き出し（リポジトリルートから macOS で実行）:

```sh
swift scripts/prepare-app-store-images.swift artifacts/app-store/2026-10-03/iphone-6.9/*.png
```

撮影用 seed は `packages/db/src/seed/public-page.ts`。手順は `docs/user-stories/view-service-introduction.md` を参照。

今回の確認: Simulator でアプリを起動し画面を取得。操作ツールの `noWindowsAvailable` エラーにより、新規撮影および画面遷移の再確認は未完了。App Store Connect へのアップロード・本番 LP のデプロイは行っていない。

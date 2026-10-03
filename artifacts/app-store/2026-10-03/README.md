# App Store 用スクリーンショット

1284 × 2778 px を要求する提出枠には `iphone-6.5/` の3枚を使用する。透過なしの sRGB PNG。元画像の縦横比を維持して縮小し、上下の余白を約6 pxずつ切り落としている。

```sh
swift scripts/prepare-app-store-images.swift --iphone-6.5 artifacts/app-store/2026-10-03/iphone-6.9/*.png
```

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

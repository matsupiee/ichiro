# iPad 用 App Store スクリーンショット

13インチ iPad の提出枠用。2048 × 2732 px、縦向き、透過なしの sRGB PNG。
iPad Air 13-inch (M4) / iPadOS 26.4.1 の Simulator でネイティブアプリを実際に操作して撮影。

1. `ipad-13/01-commitments.png` — 読書・英語・ウォーキングの目標一覧
2. `ipad-13/02-progress.png` — 連続達成6日と今日の報告ボタン
3. `ipad-13/03-celebration.png` — 報告後のワンちゃんと連続達成7日

## 撮影手順

1. ローカル API と Metro を起動する。
2. `packages/db/src/seed/public-page.ts` の撮影用 seed をローカル DB に投入する。既存の [撮影手順](../../../docs/user-stories/view-service-introduction.md)を参照。
3. iPad Simulator にネイティブアプリをインストールし、撮影用アカウントでログインする。
4. 一覧、読書の目標詳細、今日の達成報告後のお祝いの順に撮影する。ダイアログ・キーボード・開発用表示が写っていないことを確認する。

```sh
xcrun simctl launch --terminate-running-process <IPAD_DEVICE_UDID> com.anonymous.ichiro -RCT_enableDev NO -RCT_enableMinification YES
# 初回のバンドル生成と読み込みが終わるまで待つ。
xcrun simctl io <IPAD_DEVICE_UDID> screenshot artifacts/app-store/2026-10-04/ipad-13/01-commitments.png
# 各画面へ移動し、02-progress.png、03-celebration.png も同様に撮影する。
swift scripts/prepare-app-store-images.swift --ipad-13 artifacts/app-store/2026-10-04/ipad-13/*.png
sips -g pixelWidth -g pixelHeight -g hasAlpha artifacts/app-store/2026-10-04/ipad-13/*.png
```

書き出し処理は実寸を維持して透過チャンネルを除去する。iPhone の画像からの引き伸ばしではない。
利用規約・プライバシーポリシー・特商法表記の変更を伴う仕様変更はない。

仕様: [Apple のスクリーンショット寸法](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

# アプリアイコンのビルドと確認

## 構成

`apps/native/assets/images/app-icons/` の提供画像を元のまま保存し、ビルド時に必要なPNGを生成する。白い余白と角丸は提供画像の一部であり、画像生成による描き直しは行わない。

`app.json` の標準アイコンは青。`plugins/with-app-icons.cjs` がiOSの代替アセットとAndroidの起動口を生成する。`modules/app-icon/` のローカルExpoモジュールからOSの設定を読み書きする。

- iOS：`setAlternateIconName` をメインスレッドで呼ぶ。青に戻す際は `nil` を渡す。
- Android：`.MainActivity` のディープリンクを維持し、ランチャーだけを3つのaliasに移す。Android 13以降は有効状態を一括更新し、それ以前は新しい起動口を有効にしてから他を無効にする。
- アカウントの切り替えやログアウトによって、端末に設定したアイコンは変えない。
- 画像追加やネイティブコード変更には再ビルドが必要。Expo GoやJavaScriptだけの更新では追加できない。

## 実行

1. リポジトリのルートで `bun run test`、`bun run check-types`、`bun run check:patterns`、`bunx oxlint` を実行する。
2. `apps/native` で `bunx expo prebuild --platform ios --no-install`、`bunx expo run:ios` を実行する。
3. ログイン後、`maestro --device <SimulatorのUDID> test .maestro/app-icon.yaml` をリポジトリのルートで実行する。
4. ホーム画面で3色の見た目を確認し、各アイコンを押してアプリに戻れることを確認する。
5. Androidも `apps/native` で `bunx expo prebuild --platform android --no-install`、`bunx expo run:android` を実行し、同じ操作を確認する。
   - ランチャーのキャッシュによる反映待ち、再起動後の選択保持、アップデート後の起動も確認する。

ログイン用データは既存の `packages/db/src/seed/run.ts` を利用する。OSに保存する設定なので、アイコン専用のDBデータは不要。

既存ストーリーは `bun run test` のAPI・サーバー・環境設定のテストで回帰確認する。画面固有の見た目とOSの動作はネイティブで別途確認する。全画面を手動で再操作することとは区別する。

## 参考資料

- [Expoのローカルモジュール](https://docs.expo.dev/modules/get-started/)
- [ExpoのModule API](https://docs.expo.dev/modules/module-api/)
- [Appleの代替アイコン設定](https://developer.apple.com/documentation/xcode/configuring-your-app-to-use-alternate-app-icons)
- [Androidのactivity-alias](https://developer.android.com/guide/topics/manifest/activity-alias-element)
- [AndroidのPackageManager](https://developer.android.com/reference/android/content/pm/PackageManager)

## 確認結果（2026年10月2日）

- iOSのDebugビルド成功（エラー・警告なし）。
- iPhone 17e / iOS 26.4.1 Simulatorで、初期選択が青であること、紫→ピンク→青の切り替え、各色のホーム画面表示とアイコンからの起動を手動確認した。
- 紫を選んだ状態でプロセスを終了し、ホーム画面のアイコンから再起動しても紫の選択が保持された。
- 既存のseedアカウントでログインし、変更中の操作無効化と変更後の選択表示も確認した。最後は青に戻した。
- 既存回帰テスト154件と追加のAndroid起動設定テスト2件が成功。型チェック、lint、バックエンド構成チェックも成功。
- `.maestro/app-icon.yaml` は再実行用のフローとして追加。今回の端末操作は手動で確認した。
- Androidはprebuildとモジュールの自動リンクを確認済み。Android SDKが見つからないため、Androidのビルド・端末動作は未確認。

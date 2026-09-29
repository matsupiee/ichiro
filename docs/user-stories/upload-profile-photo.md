# プロフィール写真をアップロードできる

> ステータス: 実装済み

## ストーリー

ログイン中のユーザーとして、プロフィール写真を選んでサーバーに保存したい。
iPhone で撮った HEIC の写真も、自分で形式を変えずに選びたい。
機種変更やほかの端末でログインしても同じ写真が出て、チェックしてくれる友達にも自分だと分かってもらえるから。

## 動作確認の手順

`bun run db:seed` でデモデータを入れ、demo@ichiro.app / password123 でログインしておく。デモユーザーは写真なしで始まる。

macOS では iOS Simulator を起動して `bun run packages/db/src/seed/avatar-photos.ts` を実行すると、確認用の JPEG・PNG・HEIC が写真ライブラリに追加される。

1. メインページの右上のプロフィールアイコンを押し、「プロフィール写真」の行を押す。
   - 「写真を選択」「削除」のポップアップが出る。
   - → [プロフィールのシートでアカウントを管理できる](./profile-sheet.md)
2. 「写真を選択」を押して写真を選ぶ。
   - iPhone では HEIC の写真も選べ、形式のエラーにならず保存できる。確認用画像は JPEG・PNG・HEIC の順に追加される。
   - iPhone・Android では正方形に切り抜く画面が出る。Web では切り抜き画面は出ず、写真の中央が正方形に切り抜かれる。
   - 選んだ写真がすぐにシートとメインページのアイコンに出て、アップロードが終わるまで白いくるくるが重なる。
   - アップロード中は「プロフィール写真」の行を押せない。
   - 終わるとくるくるが消え、写真はそのまま残る。
3. アプリを開き直す。ほかの端末や Web で同じアカウントにログインする。
   - 同じ写真が出る。
4. もう一度「写真を選択」から別の写真を選ぶ。
   - JPEG・PNG の写真でも手順2〜4を繰り返し、保存と再表示ができる。
   - 新しい写真に変わる。前の写真はサーバーから消える。
5. 「削除」を押す。
   - 灰色の丸に戻る。開き直しても灰色の丸のまま。
   - 写真がないときに「削除」を押しても何も起きない。
6. 通信できない状態で写真を選ぶ。
   - 「写真を保存できませんでした」のアラートが出て、元の写真（または灰色の丸）に戻る。

## データの持ち方

- 写真の本体は Cloudflare R2 のバケット（`AVATARS` バインディング）に置く。
  - キーは `avatars/<ユーザーID>/<cuid2>.<拡張子>`。差し替えるたびに新しいキーになるので、URL が変わり、古いキャッシュが出ることはない。
  - バケットは公開せず、Worker の `GET /avatars/<ユーザーID>/<ファイル名>` から配信する。ログインなしで読める。友達に見せるため。
- `user.image` には `/avatars/...` のサーバーからの相対パスを入れる。アプリは API の URL につなげて表示する。
  - `http` で始まる外部の URL が入っていれば、そのまま表示する。削除しても外部の写真には触れない。
- アップロードは `PUT /api/profile/avatar`、削除は `DELETE /api/profile/avatar`。画像のバイナリを JSON に載せないよう、tRPC ではなく素の HTTP で受ける。
  - 受け付けるのは JPEG・PNG・WebP で、5MB まで。宣言された形式と中身の先頭バイトが一致しないものは断る。
  - アプリは上げる前に 512px 四方の JPEG に縮めるので、ふつうは数十KB になる。
  - HEIC など端末で読み込める写真も JPEG に変換して送る。送信する本体は ArrayBuffer とし、ローカルファイルの Blob の MIME 型によって `Content-Type: image/jpeg` が上書きされないようにする。
  - 新しい写真を保存して `user.image` を書きかえてから、前の写真を消す。途中で失敗しても写真が消えた状態にはならない。
- 以前のバージョンで端末の Secure Store に保存していた写真の場所（`ichiro.avatar.<ユーザーID>`）は使わない。

## 対応するテスト

- アップロードは `packages/api/src/routers/consumer/profile/upload-avatar/handler.integration.test.ts`
- 削除は `packages/api/src/routers/consumer/profile/delete-avatar/handler.integration.test.ts`
- 配信は `packages/api/src/routers/consumer/profile/get-avatar/handler.integration.test.ts`

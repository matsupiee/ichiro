# ローカル D1 を Drizzle Studio で確認する

Alchemy の開発サーバーが使うローカル D1 のテーブルやレコードを、ブラウザで確認する手順。

## 前提

Bun とプロジェクトの依存パッケージをインストールし、開発サーバーの環境設定を用意しておく。
コマンドはリポジトリのルートで実行する。Cloudflare の認証情報は不要。

## 起動と確認

1. リポジトリのルートで `bun run dev:server` を起動する。
2. 別のターミナルで `bun run db:studio` を実行する。
3. 表示された接続先が `packages/infra/.alchemy/local/d1` 内にあることを確認する。
4. https://local.drizzle.studio を開き、`user`・`commitment`・`report` などのテーブルを確認する。
   - ブラウザがローカルネットワークへのアクセス許可を求めたら許可する。画面が空のままの場合は、サイトの権限設定を確認して再読み込みする。
5. 必要なら、既存の `packages/db/src/seed/run.ts` でデモデータを作る。表示された SQLite の絶対パスを使い、ルートで `bun run db:seed -- --url file:/絶対パス/対象.sqlite --skip-migrations` を実行する。この操作はデモデータを書き込む。
6. Studio を再読み込みしてデモデータを確認する。終了するときはターミナルで Ctrl+C を押す。

## 接続先の選択

`metadata.sqlite` と WAL・SHM ファイルは候補から除外する。対象がひとつなら自動選択する。
対象がないときはサーバーの起動を案内し、複数あるときは候補を表示して停止する。
複数ある場合は `D1_LOCAL_PATH=/絶対パス/対象.sqlite bun run db:studio` で選択する。
相対パスを指定する場合は `packages/db` が基準になる。存在しないファイルは新規作成しない。

接続先はローカルの SQLite ファイル。Cloudflare の認証情報は不要で、デプロイ済み D1 の設定には影響しない。
Studio での編集は、アプリが使うローカルデータにも反映される。

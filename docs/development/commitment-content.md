# コミット内容への統一と DB 初期化

## 今回の変更

`commitment.goal` を削除し、作成・編集・ホーム一覧・達成メッセージ・決済説明に `content` を使う。報告頻度・期間・罰金などの設定は引き続き保存する。

差分マイグレーションは既存の `content`、達成報告、罰金、変更履歴を保持する。過去の変更履歴に含まれる `goal` はそのまま残し、今後の変更履歴には含めない。利用規約・プライバシーポリシー・特定商取引法に基づく表記も入力項目に合わせて更新する。

## 確認手順

1. `bun run dev` を起動する。Alchemy がローカル D1 に差分を適用する。
2. `packages/db/src/seed/run.ts` に `--url file:ローカルDBの絶対パス --skip-migrations` を渡す。既存のデモアカウントを作り直すため専用データで行う。
3. iOS Simulator でアプリを起動し、demo@ichiro.app / password123 でログインする。
4. ホームにコミット内容が表示され、作成・詳細フォームに目標欄がないことを確認する。
5. `.maestro/self-check.yaml` と `.maestro/report-confirmation.yaml` で作成・保存・達成報告を確認する。`.maestro/retired-invite.yaml` で旧共有リンクからホームへ戻れることを確認する。
6. `bun run test` で全ストーリーの回帰テストを実行する。対応は [セルフチェックの確認](./self-check-verification.md) の表を参照する。退会は account/withdraw と withdrawal-migration、既存アカウントの再登録は auth の統合テストで確認する。今回の追加は `content-migration.integration.test.ts` と commitment/create の API テスト。
7. `bun run check-types`、`bun run check:patterns`、`bunx oxlint` を実行する。

## stg の全削除とマイグレーションの統合

可能。ただし通常のデプロイに毎回の初期化を組み込まず、一度だけ行う切り替えとして扱う。この変更ではリモート DB の初期化も、既存マイグレーションの統合も行っていない。

現在は stg・prod・ローカルで同じ `packages/db/src/migrations` を参照する。ファイルだけを一本化して既存 DB へ適用すると、既存テーブルの作成と衝突する。prod に維持すべき DB があるなら、その移行方針を先に決める。stg だけの初期化では共有履歴を安全に置き換えられない。

切り替え時は次の順で行う。

1. 対象の Cloudflare アカウントと stg の D1 ID を確定し、初期化する環境と残す環境を決める。
2. stg のアプリからの操作と罰金の定期実行を止め、必要なら DB をエクスポートする。
3. 現行スキーマから空の出力先へ `drizzle-kit generate` で初期マイグレーションとスナップショットを生成する。手書きの `commitment_log_before_update` トリガーも含める。
4. 過去の移行を検証するテストは、履歴をテスト用 fixture に移すか、新しい初期スキーマを検証するテストへ変更する。空の DB で seed と全テストを実行する。
5. Alchemy 管理下の stg D1 を空の DB へ切り替えるか、対象 DB のアプリテーブルとマイグレーション適用履歴を初期化する。外部キーの参照関係に従う。`sqlite_*` や Cloudflare の管理用テーブルを一括削除する SQL は使わない。Alchemy の状態ストアはアプリ DB とは別なので消さない。
6. 統合した初期マイグレーションを適用し、Worker の D1 バインディングと API を確認する。
7. stg 用テストデータを作り、ネイティブアプリで新規登録・作成・編集・達成報告を確認して利用を再開する。DB 内のセッションも消えるため再ログインが必要。

DB 初期化だけでは R2 のプロフィール画像や Stripe 側の顧客・支払い方法は消えない。それらの削除は別の操作として扱う。

## 参考

- [Drizzle のマイグレーション生成](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle のカスタムマイグレーション](https://orm.drizzle.team/docs/kit-custom-migrations)
- [D1 の SQL と外部キー](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [Expo の iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/)

## 確認結果（2026年10月1日）

- 全ストーリーの自動回帰テスト154件成功（API 129件・サーバー11件・環境設定14件）。決済説明が content を使う追加検証も成功。
- 型チェック、lint、バックエンド構成チェック、フォーマット確認が成功。Drizzle の再生成で追加のスキーマ差分がないことを確認。
- iPhone 17 Pro / iOS 26.4 Simulator でホームの表示を確認。self-check、report-confirmation、retired-invite の各 Maestro テストが成功。
- content だけで作成し、編集した値がホームと再表示した詳細に残ること、達成報告の確認・キャンセル・確定、旧共有リンクからの復帰を確認。
- ローカル D1 に差分を適用済み。stg / prod の削除・デプロイ・マイグレーション統合は未実施。

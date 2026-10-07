# セルフチェックへの移行の確認

## 対象

友達への依頼API・招待画面・チェック者設定を削除する。既存のコミットメントと報告・罰金は保持し、旧チェック者設定は変更履歴に保存してから列を削除する。

## 自動テスト

リポジトリのルートで `bun run test`、`bun run check-types`、`bun run check:patterns`、`bunx oxlint` を実行する。

全ユーザーストーリーの回帰確認は、次の既存テストと追加テストで行う。

| ストーリー                                                         | 確認するテスト                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| onboarding / verify-email / change-email                           | API の auth.integration.test.ts                                                 |
| commitment-list                                                    | commitment/list と schedule.test.ts                                             |
| create-commitment / edit-commitment                                | commitment/create・get・update                                                  |
| report-achievement                                                 | commitment/report と schedule.test.ts                                           |
| commitment-edit-log                                                | commitment-log.integration.test.ts                                              |
| self-check                                                         | self-check.integration.test.ts と self-check-migration.integration.test.ts      |
| penalty-collection                                                 | penalty 配下と handle-stripe-event.integration.test.ts                          |
| register-payment-method                                            | payment 配下と payment-method-deletion.integration.test.ts                      |
| profile-sheet / upload-profile-photo                               | profile 配下・payment/list-methods・auth.integration.test.ts                    |
| read-legal-documents / contact-support / view-service-introduction | apps/web/src/server/public-page.test.ts と public-page-seed.integration.test.ts |
| staging-isolation                                                  | deployment-settings.test.ts と auth.integration.test.ts                         |

画面の流れは `bun run test:e2e` の Playwright の E2E テストで確認する。セルフチェックは `apps/web/e2e/commitments.spec.ts` が受け持つ。手順は [E2E テスト](./e2e.md)を参照する。

Stripe の決済はテスト用実装で確認する。実課金・メール送信・リモート環境へのデプロイはこの確認には含めない。変更のない全画面の手動再確認を意味するものではない。

## ブラウザでの確認

1. リポジトリのルートで `bun run dev:server` を起動する。ローカル D1 にマイグレーションが適用される。
2. 必要なら移行済みのローカルDBに `packages/db/src/seed/run.ts` の `--url` と `--skip-migrations` でデータを投入する。
   - `bun run db:seed -- --url file:/絶対パス/対象.sqlite --skip-migrations` で、`demo@ichiro.app` / `password123` のデモユーザーができる。
3. ブラウザで http://localhost:3000/app を開き、テスト用アカウントでログインする。
4. 右下の＋からコミットメントを作成する。
   - 罰金は設定しない。作成後のお祝い画面に、友達への依頼ボタンが出ない。
5. 作成したコミットメントの詳細を開く。
   - チェック者の設定がなく、編集して保存できる。
   - 「今日の達成を報告する」で本人が報告でき、お祝い画面を閉じられる。

旧招待リンクはネイティブアプリの画面だったため、Web 版には招待の画面を作っていない。
確認ではローカルアカウントにコミットメントを作るので、専用アカウントを使う。

## 移行の参考資料

[Drizzle のマイグレーション生成](https://orm.drizzle.team/docs/drizzle-kit-generate)に沿ってスキーマ差分を生成し、データとトリガーを保持するSQLに調整した。テーブルの作り直しによる子レコードへの影響を避け、不要な列のみ削除する。

お祝い画面は、ほかの画面やシートより前面に出す全画面のオーバーレイ（`role="dialog"`）にする。

## 確認結果（2026年9月30日）

- `bun run test`：136件成功（API 111件、サーバー11件、環境設定14件）。
- 型チェック、lint、バックエンド構成チェック、マイグレーションのスキーマ一致を確認。
- 画面の確認は Web 版へ移行する前のネイティブアプリ（iPhone 17 Pro / iOS 26.4 Simulator）で行った。
- 作成後の依頼ボタン削除、詳細のチェック者設定削除、編集保存、本人の達成報告、お祝い画面の終了、旧リンクからホームへの復帰を確認。
- ローカルDBへの移行は適用済み。リモート環境にはデプロイしていない。

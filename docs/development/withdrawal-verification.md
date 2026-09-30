# 退会機能の動作確認

## 方針と公式資料

退会時に `user.withdrawnAt` を設定し、全セッションを失効する。既存のアカウント・記録・支払い情報は保持する。退会受付と完了を分けず、Stripe の確認や実行中の操作の終了を待たない。

[Better Auth のセッション作成フック](https://better-auth.com/docs/concepts/users-accounts#callbacks)で退会済みユーザーのログインを拒否する。確認とセッション作成の間に退会が入る競合は、DBトリガーでも拒否する。

退会日時とセッション失効は D1 の batch でまとめる。決済処理は毎時5分に動く。各罰金の徴収開始時に、未退会であることの判定と `penalty.status` の `processing` への変更を同じ更新で行い、並行ジョブの二重請求を防ぐ。退会前に開始した決済は退会後に完了する場合があり、その結果を保存する。退会後の新規請求・再試行は行わない。

通信断などで結果が不明な罰金は `processing` に残し、自動再請求しない。Webhook または運用で Stripe のリクエストログと冪等キー `penalty:<id>:<attempts>` を照合する。この確認は退会完了を妨げない。

既存の退会受付日時があるDBは、マイグレーションで退会日時に引き継いでから不要な2カラムを削除する。

## 自動テスト

`bun run test`、`bun run check-types`、`bun run check:patterns`、`bunx oxlint` を実行する。

全ユーザーストーリーの回帰テストは次の対応で確認する。

| ストーリー                                                         | テスト                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| onboarding / verify-email / change-email                           | auth.integration.test.ts                                                                                    |
| commitment-list                                                    | commitment/list と schedule.test.ts                                                                         |
| create-commitment / edit-commitment                                | commitment/create・get・update                                                                              |
| report-achievement                                                 | commitment/report と schedule.test.ts                                                                       |
| commitment-edit-log                                                | commitment-log.integration.test.ts                                                                          |
| self-check                                                         | self-check.integration.test.ts と self-check-migration.integration.test.ts                                  |
| penalty-collection                                                 | penalty 配下と handle-stripe-event.integration.test.ts                                                      |
| register-payment-method                                            | payment 配下と payment-method-deletion.integration.test.ts                                                  |
| profile-sheet / upload-profile-photo                               | profile 配下・payment/list-methods・auth.integration.test.ts                                                |
| read-legal-documents / contact-support / view-service-introduction | server の public-page.test.ts と public-page-seed.integration.test.ts                                       |
| staging-isolation                                                  | deployment-settings.test.ts と auth.integration.test.ts                                                     |
| withdrawal                                                         | account/withdraw/handler.integration.test.ts・auth.integration.test.ts・withdrawal-seed.integration.test.ts |

罰金の同時実行、決済中の即時退会、遅延Webhook、通信断、セッション作成との競合を含む。Stripe はテスト用実装で確認し、実課金しない。

## ネイティブでの確認

1. `bun run dev` でローカルAPIとMetroを起動する。ローカルD1にマイグレーションが適用される。
2. `bun run --cwd packages/db db:seed:withdrawal --url file:/絶対パス/対象.sqlite --skip-migrations` を実行する。
   - 既存の専用アカウントがある場合は `--email withdrawal-2@ichiro.example` のように別アドレスを指定する。
3. iOS Simulatorでアプリを起動し、表示されたメールアドレスと `withdrawal-demo-password` でログインする。ログイン画面からは `.maestro/withdrawal-login.yaml` に `EMAIL` を渡して実行できる。
4. `maestro --device <Simulator UUID> test -e EMAIL=withdrawal@ichiro.example .maestro/withdrawal.yaml` を実行する。
   - シートの切り替え、チェックによる有効化、戻った際のチェック解除、退会、再ログイン拒否を確認する。
5. 別の専用アカウントでログインし、`.maestro/self-check.yaml` と `.maestro/retired-invite.yaml` で既存の作成・編集・報告と旧共有リンクの動作を確認する。

ブラウザ・Expo Web での代用は行わない。デプロイ先のDBや既存ユーザーへの退会操作は行わない。

## 規約の確認

利用規約と特定商取引法の表記に、退会による新しい請求・再請求の停止と処理中の決済の扱いを反映する。プライバシーポリシーは、退会で自動削除する印象にならないよう、削除請求への対応手順についての表現に修正する。退会シートにはデータ保持についての注意書きを追加しない。

## 簡素化後の確認結果（2026年9月30日）

- APIを含む全ユーザーストーリーの回帰テスト152件が成功。
- 退会受付済みデータの移行、不要カラムの削除、セッション作成拒否を追加テストで確認。
- `bun run check-types`、`bun run check:patterns`、`bunx oxlint` が成功。
- ローカルDBにマイグレーションを適用し、退会関連カラムが `withdrawn_at` のみであることを確認。
- iPhone 17 Pro / iOS 26.4 Simulatorで `withdrawal-login.yaml`、`self-check.yaml`、`retired-invite.yaml`、`withdrawal.yaml` が成功。即時退会と再ログイン拒否を確認。
- 退会後のローカルDBで退会日時の保存とセッション0件を確認。
- リモート環境へのデプロイと実Stripeでの決済操作は行っていない。

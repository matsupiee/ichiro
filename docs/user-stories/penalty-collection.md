# 報告できなかった日は罰金が徴収される

> ステータス: 実装済み（Stripe で引き落とす。本人認証が必要なカードで失敗したときに、ユーザーに認証してもらう流れは未実装）

## ストーリー

罰金を設定したユーザーとして、報告日の 23:59:59 までに報告できなかったら、決めた金額を本当に払いたい。
払わずに済む抜け道がないからこそ、毎回きちんとやろうと思えるから。

## 動作確認の手順

この手順は、昨日の分の罰金がまだ精算されていない状態から始める。
`bun run db:seed -- --url file:./local.db --today <昨日の日付>` でデモデータを入れ、demo@ichiro.app / password123 でログインしておく。
デモデータは、指定した日付の前日までを精算ずみにして作る。昨日を指定すると、昨日の「広東語マスター」が未報告・未精算のまま残る。
デモデータの支払い方法は Stripe に実在しない ID なので、そのままでは引き落としに失敗する。本当に引き落とすところまで確かめるときは、Stripe のテスト環境に Customer を作ってテストカードをつけ、その ID を渡してデモデータを入れる。

```sh
stripe customers create                                          # cus_... が返る
stripe payment_methods attach pm_card_visa --customer cus_...    # pm_... が返る
bun run db:seed -- --url file:./local.db --today <昨日の日付> --stripe-customer cus_... --stripe-payment-method pm_...
```

「禁煙」と「広東語マスター」の引き落とし先が、このテストカード（Visa •••• 4242）になる。

1. メインページで「広東語マスター」のカードを押して、詳細ページを開く。
   - 連続達成のカードの下に「これまでの罰金」のカードが出る。
   - 昨日の日付の行に「徴収待ち」と ¥500 が出る。開いた時点で締め切りを過ぎた分が精算され、cron を待たずに履歴に出る。
   - それより前に報告できなかった2日分が「徴収ずみ」で出て、合計は ¥1,500、回数は3回になる。
   - 連続達成は、昨日が途切れたので0日になる。
2. 1時間ごとの cron（毎時5分）が動いたあとに、もう一度詳細ページを開く。
   - 「徴収待ち」だった行が「徴収ずみ」に変わる。Stripe のダッシュボードに ¥500 の支払いが「ichiro 罰金「広東語マスター」<日付>」という説明で出る。
   - 昨日が報告日（月・水・金）で未報告だった「体づくり」にも、¥1,000 の罰金ができて徴収される。
   - 報告ずみの「禁煙」には罰金ができない。
3. `pm_card_visa` の代わりに `pm_card_chargeCustomerFail`（登録はできるが、請求は必ず拒否される）をつけてデモデータを入れ直し、同じように cron を待つ。
   - 行が赤い「徴収できませんでした」になり、その下に「カードが拒否されました」と理由が出る。
   - 失敗した罰金も「これまでの罰金」の合計に入る。
   - 次の cron で試し直す。3回失敗したらそれ以上は試さない。
4. 詳細ページで「今日の達成を報告する」を押す。
   - 今日の分は締め切り前なので、ふつうに報告できる。
   - → [今日の達成を報告すると、ワンちゃんが祝福してくれる](./report-achievement.md)
5. 罰金の金額を変えて「変更を保存」を押す。
   - 金額の下に「変更した金額と支払い方法は、今日の報告分から使われます。」と出ている。
   - 締め切りを過ぎた分は、変更前の金額で精算される。終了日を延ばしても、終わっていた期間の分はさかのぼって徴収されない。
   - → [コミットメントの詳細を見て、途中で設定を変えられる](./edit-commitment.md)
6. 罰金を設定していないコミットメントの詳細ページを開く。
   - 「これまでの罰金」のカードは出ない。報告できなくても罰金はできない。
7. 罰金を設定したばかりのコミットメントの詳細ページを開く。
   - 「これまでの罰金」は ¥0 で、「まだ罰金はないワン。この調子でつづけよう。」と出る。

## データの持ち方

- `penalty` テーブルに、報告できなかった報告日1日につき1行を持つ。
  - `user_id` と `commitment_id` は `ON DELETE RESTRICT` とし、罰金から参照されるユーザーとコミットメントの削除を防ぐ。
  - 同じコミットメント・同じ日の罰金は1件だけ（`commitment_id` と `due_date` のユニーク制約）。cron が重なっても二重に徴収しない。
  - `amount` と `payment_method_id` は、精算した時点のコミットメントの設定を写す。あとで設定を変えても、過去の罰金の金額と引き落とし先は変わらない。
  - `status` は `pending`（徴収待ち）・`processing`（決済開始済み・結果確認待ち）・`paid`（徴収ずみ）・`failed`（徴収できなかった）のどれか。
  - 引き落としに失敗したら `attempts` を1つ増やし、理由を `failure_message` に残す。カード拒否など結果が確定した失敗は3回までは次の cron で試し直す。失敗した罰金も「これまでの罰金」の合計に入る。
  - 支払い方法がない罰金（この変更より前に作られたコミットメントなど）は、Stripe を呼ばずに「支払い方法が登録されていません」で失敗にする。
- `commitment.settled_through` に、どの報告日まで精算したかを持つ。
  - 作成したときは前日にする。今日の分から精算の対象になる。
  - null はこの機能より前に作られた行。初めて精算するときは昨日までを精算ずみにするだけで、過去の分はさかのぼらない。
  - 設定を変えるときは、先に変更前の設定で精算してから、昨日までを精算ずみにする。
  - 報告は、精算ずみの日には受け付けない（「締め切りを過ぎたため報告できません」）。端末の日付をずらして、締め切り後に報告して罰金を逃れることはできない。
- `commitment.time_zone` に、締め切りを判定するタイムゾーン（IANA 名）を持つ。
  - アプリが作成・変更のたびに端末のタイムゾーンを送る。送られなかったときは `Asia/Tokyo`。
- 精算と徴収は Cloudflare Workers の cron（`packages/infra/alchemy.run.ts` の `crons`）で1時間ごとに動く。
  - 精算は詳細ページを開いたとき・設定を変えたとき・報告したときにも、そのコミットメントについて行う。
- 引き落としは Stripe の PaymentIntent で行う（`packages/api/src/shared/payment/charge-penalty.ts`）。
  - ユーザーがアプリを開いていないときの決済なので、登録ずみの支払い方法に `off_session: true`・`confirm: true` で請求する。通貨は円（`jpy`）。
  - 冪等キーは `penalty:<罰金のID>:<何回目か>`。cron が重なっても同じ試行で二重に請求しない。試し直すときはキーを変える。
  - PaymentIntent の ID を `charge_reference` に、罰金の ID を PaymentIntent の `metadata.penalty_id` に持つ。
  - 通信断などで結果が不明な場合は、その罰金を `processing` として再請求を保留し、運用でStripeの結果を確認する。→ [退会機能の動作確認](../development/withdrawal-verification.md)
  - 退会後は罰金の生成・請求・再試行の対象にしない。→ [退会できる](./withdrawal.md)
  - Stripe 側で処理中（`processing`）になったものは試し直さず、Webhook（`/stripe/webhook`）の `payment_intent.succeeded`・`payment_intent.payment_failed` で結果を反映する。先に成功が届いていたら、あとから届いた失敗で上書きしない。

## 対応するテスト

- 削除による履歴の消失を防ぐ制約は `packages/api/src/shared/penalty/penalty-deletion.integration.test.ts`。既存のデモ seed を使って確認する。
- `packages/api/src/shared/penalty/run-penalty-job.integration.test.ts`（Stripe は偽物に差し替える）
- 設定を変えたときの扱いは `packages/api/src/routers/consumer/commitment/update/handler.integration.test.ts` の「設定を変えても、過去の分の罰金は変わらない」
- Webhook での反映は `packages/api/src/shared/payment/handle-stripe-event.integration.test.ts`
- 締め切りの判定と、罰金の対象になる日の計算は `packages/api/src/shared/penalty/penalty.test.ts`

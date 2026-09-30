# 自分で達成をチェックする

> ステータス: 実装済み

## ストーリー

ログイン中のユーザーとして、自分で目標の達成を報告したい。
他の人の承諾や確認を待たずに、報告期限までに自分で記録を完了できるから。

## 動作確認の手順

`bun run db:seed -- --url file:/ローカルDBの絶対パス --skip-migrations` で、移行済みのローカルDBにデモデータを作る。demo@ichiro.app / password123 でログインする。

1. 新しいコミットメントを作成する。
   - チェック者の選択は表示されない。
   - 作成後のお祝い画面は「ホームに戻る」で閉じられる。友達への依頼ボタンはない。
2. 詳細を開いて設定を保存する。
   - チェック者の選択や招待リンクの発行は表示されない。
3. 報告日に「今日の達成を報告する」を押す。
   - お祝い画面が表示され、閉じると報告済みになる。
   - 他のユーザーは代わりに報告できない。
4. 廃止前に発行した `ichiro://invite/<token>` をネイティブアプリで開く。
   - 依頼内容や承諾ボタンは表示されない。招待APIも利用できない。

## データの持ち方

- `commitment.user_id` の本人が達成を報告する。
  - チェック者と招待トークンの列は削除する。
  - 移行後もコミットメント・報告・罰金を保持する。
- `commitment_log` の既存履歴は保持する。
  - 旧チェック者や未承諾リンクの最終状態も、列の削除前に履歴へ保存する。
  - 履歴のトークンを使って依頼を承諾することはできない。

## 対応するテスト

- `.maestro/self-check.yaml`：作成・お祝い・編集・本人による達成報告。
- `.maestro/retired-invite.yaml`：旧招待リンクの無効化とホームへの復帰。
- `packages/api/src/test/self-check-migration.integration.test.ts`：既存データと履歴の保持、列削除後の履歴記録。
- `packages/api/src/test/self-check.integration.test.ts`：招待APIの廃止とレスポンスからの関連項目の削除。
- `packages/api/src/routers/consumer/commitment/report/handler.integration.test.ts`：本人の報告、他人の報告拒否、締め切り。

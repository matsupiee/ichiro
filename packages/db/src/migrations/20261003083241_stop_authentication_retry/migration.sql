ALTER TABLE `penalty` ADD `retry_stopped_at` integer;
--> statement-breakpoint
-- 旧実装で本人認証エラーになった未決済分も、リリース後に再請求しない。
UPDATE penalty
SET retry_stopped_at = updated_at,
    failure_message = 'カードの本人認証が必要なため、この報告日分の自動請求を停止しました'
WHERE status = 'failed'
  AND failure_message = 'カードの本人認証が必要なため引き落とせませんでした';

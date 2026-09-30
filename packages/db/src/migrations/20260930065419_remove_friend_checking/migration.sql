-- 旧チェック者の最終状態は既存トリガーで履歴に残す。
UPDATE commitment SET checker = 'self', checker_user_id = NULL, share_token = NULL
WHERE checker <> 'self' OR checker_user_id IS NOT NULL OR share_token IS NOT NULL;
--> statement-breakpoint
DROP TRIGGER commitment_log_before_update;
--> statement-breakpoint
DROP INDEX commitment_share_token_unique;
--> statement-breakpoint
ALTER TABLE commitment DROP COLUMN checker_user_id;
--> statement-breakpoint
ALTER TABLE commitment DROP COLUMN share_token;
--> statement-breakpoint
ALTER TABLE commitment DROP COLUMN checker;
--> statement-breakpoint
CREATE TRIGGER `commitment_log_before_update`
BEFORE UPDATE ON `commitment`
FOR EACH ROW
BEGIN
  INSERT INTO `commitment_log` (`commitment_id`, `snapshot`)
  VALUES (OLD.id, json_object(
    'id', OLD.id,
    'createdAt', OLD.created_at,
    'updatedAt', OLD.updated_at,
    'userId', OLD.user_id,
    'goal', OLD.goal,
    'content', OLD.content,
    'frequency', OLD.frequency,
    'weekdays', json(OLD.weekdays),
    'monthDays', json(OLD.month_days),
    'startDate', OLD.start_date,
    'untilDate', OLD.until_date,
    'penaltyAmount', OLD.penalty_amount,
    'paymentMethodId', OLD.payment_method_id,
    'timeZone', OLD.time_zone,
    'settledThrough', OLD.settled_through
  ));
END;

DROP TRIGGER commitment_log_before_update;
--> statement-breakpoint
ALTER TABLE `commitment` DROP COLUMN `goal`;
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

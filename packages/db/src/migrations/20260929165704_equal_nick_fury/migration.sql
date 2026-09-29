CREATE TABLE `commitment_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`commitment_id` text NOT NULL,
	`logged_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `commitment_log_commitmentId_id_idx` ON `commitment_log` (`commitment_id`,`id`);
--> statement-breakpoint
-- アプリ・精算ジョブ・直接 SQL のどの更新も、実際に更新される行の旧値を原子的に残す。
-- commitment に列を追加するときは、このトリガーの snapshot も新しい migration で更新する。
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
    'checker', OLD.checker,
    'shareToken', OLD.share_token,
    'checkerUserId', OLD.checker_user_id,
    'timeZone', OLD.time_zone,
    'settledThrough', OLD.settled_through
  ));
END;

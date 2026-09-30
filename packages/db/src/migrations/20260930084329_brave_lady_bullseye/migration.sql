DROP TRIGGER session_reject_withdrawn_user;--> statement-breakpoint
UPDATE user SET withdrawn_at = coalesce(withdrawn_at, withdrawal_requested_at);--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `withdrawal_requested_at`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `active_operations`;
--> statement-breakpoint
CREATE TRIGGER session_reject_withdrawn_user
BEFORE INSERT ON session
WHEN EXISTS (SELECT 1 FROM user WHERE id = NEW.user_id AND withdrawn_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_WITHDRAWN');
END;

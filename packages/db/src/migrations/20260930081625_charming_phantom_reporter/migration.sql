ALTER TABLE `user` ADD `withdrawn_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `withdrawal_requested_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `active_operations` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER session_reject_withdrawn_user
BEFORE INSERT ON session
WHEN EXISTS (SELECT 1 FROM user WHERE id = NEW.user_id AND withdrawal_requested_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_WITHDRAWN');
END;

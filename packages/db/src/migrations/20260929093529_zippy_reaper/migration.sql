ALTER TABLE `commitment` ADD `checker_user_id` text REFERENCES user(id) ON DELETE SET NULL;--> statement-breakpoint
-- 閲覧用だった旧リンクは失効させる。新しい依頼はアプリ内の承認でチェック者を確定する。
UPDATE `commitment` SET `checker` = 'self', `share_token` = NULL;

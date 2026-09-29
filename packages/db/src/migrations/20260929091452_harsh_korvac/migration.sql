-- 親テーブルを作り直すと D1 で報告・罰金に CASCADE が及ぶため、列を直接変更する。
ALTER TABLE `commitment` ADD `share_token` text;--> statement-breakpoint
UPDATE `commitment` SET `share_token` = lower(hex(randomblob(16))) WHERE `checker` = 'friend';--> statement-breakpoint
CREATE UNIQUE INDEX `commitment_share_token_unique` ON `commitment` (`share_token`);--> statement-breakpoint
ALTER TABLE `commitment` DROP COLUMN `friend_email`;--> statement-breakpoint
DROP TABLE `invitation`;

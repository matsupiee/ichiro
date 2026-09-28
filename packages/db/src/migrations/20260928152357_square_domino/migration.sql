PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_commitment` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`goal` text NOT NULL,
	`content` text NOT NULL,
	`frequency` text NOT NULL,
	`weekdays` text NOT NULL,
	`month_days` text NOT NULL,
	`start_date` text NOT NULL,
	`until_date` text NOT NULL,
	`penalty_amount` integer,
	`payment_method_id` text,
	`checker` text NOT NULL,
	`friend_email` text,
	`time_zone` text DEFAULT 'Asia/Tokyo' NOT NULL,
	`settled_through` text,
	CONSTRAINT `fk_commitment_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_commitment_payment_method_id_payment_method_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
INSERT INTO `__new_commitment`(`id`, `created_at`, `updated_at`, `user_id`, `goal`, `content`, `frequency`, `weekdays`, `month_days`, `start_date`, `until_date`, `penalty_amount`, `payment_method_id`, `checker`, `friend_email`, `time_zone`, `settled_through`) SELECT `id`, `created_at`, `updated_at`, `user_id`, `goal`, `content`, `frequency`, `weekdays`, `month_days`, `start_date`, `until_date`, `penalty_amount`, `payment_method_id`, `checker`, `friend_email`, `time_zone`, `settled_through` FROM `commitment`;--> statement-breakpoint
DROP TABLE `commitment`;--> statement-breakpoint
ALTER TABLE `__new_commitment` RENAME TO `commitment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `commitment_userId_idx` ON `commitment` (`user_id`);
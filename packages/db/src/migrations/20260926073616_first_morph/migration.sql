CREATE TABLE `penalty` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`commitment_id` text NOT NULL,
	`due_date` text NOT NULL,
	`amount` integer NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`charge_reference` text,
	`failure_message` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_penalty_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_penalty_commitment_id_commitment_id_fk` FOREIGN KEY (`commitment_id`) REFERENCES `commitment`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `commitment` ADD `time_zone` text DEFAULT 'Asia/Tokyo' NOT NULL;--> statement-breakpoint
ALTER TABLE `commitment` ADD `settled_through` text;--> statement-breakpoint
CREATE UNIQUE INDEX `penalty_commitment_date_idx` ON `penalty` (`commitment_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `penalty_userId_idx` ON `penalty` (`user_id`);--> statement-breakpoint
CREATE INDEX `penalty_status_idx` ON `penalty` (`status`);
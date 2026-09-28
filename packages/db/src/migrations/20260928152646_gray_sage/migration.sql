PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_penalty` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`commitment_id` text NOT NULL,
	`due_date` text NOT NULL,
	`amount` integer NOT NULL,
	`payment_method_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`charge_reference` text,
	`failure_message` text,
	`paid_at` integer,
	CONSTRAINT `fk_penalty_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_penalty_commitment_id_commitment_id_fk` FOREIGN KEY (`commitment_id`) REFERENCES `commitment`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_penalty_payment_method_id_payment_method_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_penalty`(`id`, `created_at`, `updated_at`, `user_id`, `commitment_id`, `due_date`, `amount`, `payment_method_id`, `status`, `attempts`, `charge_reference`, `failure_message`, `paid_at`) SELECT `id`, `created_at`, `updated_at`, `user_id`, `commitment_id`, `due_date`, `amount`, `payment_method_id`, `status`, `attempts`, `charge_reference`, `failure_message`, `paid_at` FROM `penalty`;--> statement-breakpoint
DROP TABLE `penalty`;--> statement-breakpoint
ALTER TABLE `__new_penalty` RENAME TO `penalty`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `penalty_commitment_date_idx` ON `penalty` (`commitment_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `penalty_userId_idx` ON `penalty` (`user_id`);--> statement-breakpoint
CREATE INDEX `penalty_status_idx` ON `penalty` (`status`);
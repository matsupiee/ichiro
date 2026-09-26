PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payment_customer` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL UNIQUE,
	`stripe_customer_id` text NOT NULL UNIQUE,
	CONSTRAINT `fk_payment_customer_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_payment_customer`(`id`, `created_at`, `updated_at`, `user_id`, `stripe_customer_id`) SELECT `id`, `created_at`, `updated_at`, `user_id`, `stripe_customer_id` FROM `payment_customer`;--> statement-breakpoint
DROP TABLE `payment_customer`;--> statement-breakpoint
ALTER TABLE `__new_payment_customer` RENAME TO `payment_customer`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payment_method` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`stripe_payment_method_id` text NOT NULL UNIQUE,
	`brand` text NOT NULL,
	`last4` text NOT NULL,
	`wallet` text,
	CONSTRAINT `fk_payment_method_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_payment_method`(`id`, `created_at`, `updated_at`, `user_id`, `stripe_payment_method_id`, `brand`, `last4`, `wallet`) SELECT `id`, `created_at`, `updated_at`, `user_id`, `stripe_payment_method_id`, `brand`, `last4`, `wallet` FROM `payment_method`;--> statement-breakpoint
DROP TABLE `payment_method`;--> statement-breakpoint
ALTER TABLE `__new_payment_method` RENAME TO `payment_method`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_report` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`commitment_id` text NOT NULL,
	`report_date` text NOT NULL,
	CONSTRAINT `fk_report_commitment_id_commitment_id_fk` FOREIGN KEY (`commitment_id`) REFERENCES `commitment`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_report`(`id`, `created_at`, `updated_at`, `commitment_id`, `report_date`) SELECT `id`, `created_at`, `updated_at`, `commitment_id`, `report_date` FROM `report`;--> statement-breakpoint
DROP TABLE `report`;--> statement-breakpoint
ALTER TABLE `__new_report` RENAME TO `report`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invitation` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`commitment_id` text NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`message_id` text,
	CONSTRAINT `fk_invitation_commitment_id_commitment_id_fk` FOREIGN KEY (`commitment_id`) REFERENCES `commitment`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_invitation`(`id`, `created_at`, `updated_at`, `commitment_id`, `email`, `kind`, `status`, `message_id`) SELECT `id`, `created_at`, `updated_at`, `commitment_id`, `email`, `kind`, `status`, `message_id` FROM `invitation`;--> statement-breakpoint
DROP TABLE `invitation`;--> statement-breakpoint
ALTER TABLE `__new_invitation` RENAME TO `invitation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `payment_method_userId_idx` ON `payment_method` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_commitment_date_idx` ON `report` (`commitment_id`,`report_date`);--> statement-breakpoint
CREATE INDEX `invitation_commitmentId_idx` ON `invitation` (`commitment_id`);
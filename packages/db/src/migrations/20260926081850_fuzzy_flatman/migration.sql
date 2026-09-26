CREATE TABLE `payment_customer` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`stripe_customer_id` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_payment_customer_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `payment_method` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`stripe_payment_method_id` text NOT NULL UNIQUE,
	`brand` text NOT NULL,
	`last4` text NOT NULL,
	`wallet` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_payment_method_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `commitment` ADD `payment_method_id` text REFERENCES payment_method(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `penalty` ADD `payment_method_id` text REFERENCES payment_method(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `payment_method_userId_idx` ON `payment_method` (`user_id`);
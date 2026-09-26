ALTER TABLE `payment_customer` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_method` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `report` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation` ADD `updated_at` integer DEFAULT 0 NOT NULL;
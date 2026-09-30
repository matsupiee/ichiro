CREATE TABLE `auth_rate_limit` (
	`key` text PRIMARY KEY,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limit_expires_idx` ON `auth_rate_limit` (`expires_at`);
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY,
	`commitment_id` text NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`message_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_invitation_commitment_id_commitment_id_fk` FOREIGN KEY (`commitment_id`) REFERENCES `commitment`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `invitation_commitmentId_idx` ON `invitation` (`commitment_id`);
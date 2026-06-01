CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_logs_created_idx` ON `activity_logs` (`created_at`);
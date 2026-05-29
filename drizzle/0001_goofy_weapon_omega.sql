CREATE TABLE `clockin_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`display_name` text NOT NULL,
	`fcu_nid` text NOT NULL,
	`token` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clockin_logs_created_idx` ON `clockin_logs` (`created_at`);
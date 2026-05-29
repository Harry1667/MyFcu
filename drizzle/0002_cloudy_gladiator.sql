ALTER TABLE `clockin_logs` ADD `verified` integer;--> statement-breakpoint
ALTER TABLE `clockin_logs` ADD `verify_message` text;--> statement-breakpoint
ALTER TABLE `clockin_logs` ADD `verify_at` integer;
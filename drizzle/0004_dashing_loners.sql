CREATE TABLE `account_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`member_ids` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);

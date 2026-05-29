CREATE TABLE `fcu_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`fcu_nid` text NOT NULL,
	`nonce` blob NOT NULL,
	`ciphertext` blob NOT NULL,
	`auth_tag` blob NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);

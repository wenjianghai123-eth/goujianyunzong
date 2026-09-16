CREATE TABLE `arrival_batch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`arrival_batch_id` text NOT NULL,
	`component_id` text NOT NULL,
	`sequence_no` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`arrival_batch_id`) REFERENCES `arrival_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_arrival_batch_items_batch_component` ON `arrival_batch_items` (`arrival_batch_id`,`component_id`);--> statement-breakpoint
CREATE INDEX `idx_arrival_batch_items_component` ON `arrival_batch_items` (`component_id`);--> statement-breakpoint
CREATE TABLE `arrival_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entry_group_id` text NOT NULL,
	`batch_code` text NOT NULL,
	`serial_expression` text NOT NULL,
	`actual_at` text NOT NULL,
	`vehicle_no` text DEFAULT '' NOT NULL,
	`receiver` text DEFAULT '' NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`component_count` integer NOT NULL,
	`created_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`operator_id` text NOT NULL,
	`operator_name` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_group_id`) REFERENCES `component_entry_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_arrival_batches_group_idempotency` ON `arrival_batches` (`entry_group_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_arrival_batches_project_time` ON `arrival_batches` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_arrival_batches_group_time` ON `arrival_batches` (`entry_group_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `component_entry_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type_code` text NOT NULL,
	`type_name` text NOT NULL,
	`location_code` text NOT NULL,
	`location_name` text NOT NULL,
	`building` text DEFAULT '' NOT NULL,
	`floor` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`specification` text DEFAULT '' NOT NULL,
	`material` text DEFAULT '' NOT NULL,
	`serial_width` integer DEFAULT 3 NOT NULL,
	`qr_token` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entry_groups_project_type_location` ON `component_entry_groups` (`project_id`,`type_code`,`location_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entry_groups_qr_token` ON `component_entry_groups` (`qr_token`);--> statement-breakpoint
CREATE INDEX `idx_entry_groups_project_status` ON `component_entry_groups` (`project_id`,`status`);--> statement-breakpoint
ALTER TABLE `components` ADD `entry_group_id` text REFERENCES component_entry_groups(id);--> statement-breakpoint
ALTER TABLE `components` ADD `sequence_no` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_components_entry_group_sequence` ON `components` (`entry_group_id`,`sequence_no`);--> statement-breakpoint
PRAGMA optimize;

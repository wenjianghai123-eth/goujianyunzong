CREATE TABLE `model_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`component_id` text NOT NULL,
	`version` integer NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`size` integer NOT NULL,
	`uploader_id` text NOT NULL,
	`uploader_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_model_assets_component_version` ON `model_assets` (`component_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_model_assets_component_time` ON `model_assets` (`component_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;

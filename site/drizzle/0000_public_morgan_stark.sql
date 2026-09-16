CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`project_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`ip` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_project_time` ON `audit_logs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`specification` text DEFAULT '' NOT NULL,
	`material` text DEFAULT '' NOT NULL,
	`batch` text DEFAULT '' NOT NULL,
	`building` text DEFAULT '' NOT NULL,
	`floor` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`current_status` text DEFAULT 'UNRECORDED' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`qr_token` text NOT NULL,
	`model_object_key` text,
	`model_file_name` text,
	`model_size` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`disabled_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_components_project_code` ON `components` (`project_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_components_qr_token` ON `components` (`qr_token`);--> statement-breakpoint
CREATE INDEX `idx_components_project_status` ON `components` (`project_id`,`current_status`);--> statement-breakpoint
CREATE INDEX `idx_components_project_updated` ON `components` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`type` text NOT NULL,
	`actual_at` text NOT NULL,
	`operator_id` text NOT NULL,
	`operator_name` text NOT NULL,
	`vehicle_no` text DEFAULT '' NOT NULL,
	`receiver` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_milestones_component_time` ON `milestones` (`component_id`,`actual_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`progress_record_id` text,
	`milestone_id` text,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploader_id` text NOT NULL,
	`uploader_name` text NOT NULL,
	`shot_at` text,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`progress_record_id`) REFERENCES `progress_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_photos_component_time` ON `photos` (`component_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `progress_records` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actual_at` text NOT NULL,
	`submitted_at` text NOT NULL,
	`operator_id` text NOT NULL,
	`operator_name` text NOT NULL,
	`operator_email` text NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`idempotency_key` text NOT NULL,
	`event_type` text DEFAULT 'PROGRESS' NOT NULL,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_progress_component_idempotency` ON `progress_records` (`component_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_progress_component_time` ON `progress_records` (`component_id`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'VIEWER' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_project_members_project_user` ON `project_members` (`project_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_project_members_user` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`require_onsite_photo` integer DEFAULT true NOT NULL,
	`require_complete_photo` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_projects_code` ON `projects` (`code`);--> statement-breakpoint
PRAGMA optimize;

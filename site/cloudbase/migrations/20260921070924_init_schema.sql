CREATE TABLE "arrival_batch_items" (
	"id" text PRIMARY KEY NOT NULL,
	"arrival_batch_id" text NOT NULL,
	"component_id" text NOT NULL,
	"sequence_no" integer NOT NULL,
	"result" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrival_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"entry_group_id" text NOT NULL,
	"batch_code" text NOT NULL,
	"serial_expression" text NOT NULL,
	"actual_at" text NOT NULL,
	"vehicle_no" text DEFAULT '' NOT NULL,
	"receiver" text DEFAULT '' NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"component_count" integer NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"project_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"wechat_openid" text NOT NULL,
	"wechat_unionid" text,
	"display_name" text NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"last_login_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_entry_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type_code" text NOT NULL,
	"type_name" text NOT NULL,
	"location_code" text NOT NULL,
	"location_name" text NOT NULL,
	"building" text DEFAULT '' NOT NULL,
	"floor" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"specification" text DEFAULT '' NOT NULL,
	"material" text DEFAULT '' NOT NULL,
	"serial_width" integer DEFAULT 3 NOT NULL,
	"qr_token" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"specification" text DEFAULT '' NOT NULL,
	"material" text DEFAULT '' NOT NULL,
	"batch" text DEFAULT '' NOT NULL,
	"building" text DEFAULT '' NOT NULL,
	"floor" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"entry_group_id" text,
	"sequence_no" integer,
	"current_status" text DEFAULT 'UNRECORDED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"qr_token" text NOT NULL,
	"model_object_key" text,
	"model_file_name" text,
	"model_size" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	"disabled_at" text
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"type" text NOT NULL,
	"actual_at" text NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"vehicle_no" text DEFAULT '' NOT NULL,
	"receiver" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"component_id" text NOT NULL,
	"version" integer NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"size" integer NOT NULL,
	"uploader_id" text NOT NULL,
	"uploader_name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"return_to" text DEFAULT '/' NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"progress_record_id" text,
	"milestone_id" text,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploader_id" text NOT NULL,
	"uploader_name" text NOT NULL,
	"shot_at" text,
	"created_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "progress_records" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"actual_at" text NOT NULL,
	"submitted_at" text NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"operator_email" text NOT NULL,
	"remark" text DEFAULT '' NOT NULL,
	"idempotency_key" text NOT NULL,
	"event_type" text DEFAULT 'PROGRESS' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"require_onsite_photo" boolean DEFAULT true NOT NULL,
	"require_complete_photo" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arrival_batch_items" ADD CONSTRAINT "arrival_batch_items_arrival_batch_id_arrival_batches_id_fk" FOREIGN KEY ("arrival_batch_id") REFERENCES "public"."arrival_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrival_batch_items" ADD CONSTRAINT "arrival_batch_items_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrival_batches" ADD CONSTRAINT "arrival_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrival_batches" ADD CONSTRAINT "arrival_batches_entry_group_id_component_entry_groups_id_fk" FOREIGN KEY ("entry_group_id") REFERENCES "public"."component_entry_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_entry_groups" ADD CONSTRAINT "component_entry_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_entry_group_id_component_entry_groups_id_fk" FOREIGN KEY ("entry_group_id") REFERENCES "public"."component_entry_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_assets" ADD CONSTRAINT "model_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_assets" ADD CONSTRAINT "model_assets_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_progress_record_id_progress_records_id_fk" FOREIGN KEY ("progress_record_id") REFERENCES "public"."progress_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_arrival_batch_items_batch_component" ON "arrival_batch_items" USING btree ("arrival_batch_id","component_id");--> statement-breakpoint
CREATE INDEX "idx_arrival_batch_items_component" ON "arrival_batch_items" USING btree ("component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_arrival_batches_group_idempotency" ON "arrival_batches" USING btree ("entry_group_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_arrival_batches_project_time" ON "arrival_batches" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_arrival_batches_group_time" ON "arrival_batches" USING btree ("entry_group_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_project_time" ON "audit_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_expires" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_users_wechat_openid" ON "auth_users" USING btree ("wechat_openid");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_users_wechat_unionid" ON "auth_users" USING btree ("wechat_unionid");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_entry_groups_project_type_location" ON "component_entry_groups" USING btree ("project_id","type_code","location_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_entry_groups_qr_token" ON "component_entry_groups" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "idx_entry_groups_project_status" ON "component_entry_groups" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_components_project_code" ON "components" USING btree ("project_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_components_qr_token" ON "components" USING btree ("qr_token");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_components_entry_group_sequence" ON "components" USING btree ("entry_group_id","sequence_no");--> statement-breakpoint
CREATE INDEX "idx_components_project_status" ON "components" USING btree ("project_id","current_status");--> statement-breakpoint
CREATE INDEX "idx_components_project_updated" ON "components" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_milestones_component_time" ON "milestones" USING btree ("component_id","actual_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_model_assets_component_version" ON "model_assets" USING btree ("component_id","version");--> statement-breakpoint
CREATE INDEX "idx_model_assets_component_time" ON "model_assets" USING btree ("component_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_expires" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_photos_component_time" ON "photos" USING btree ("component_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_progress_component_idempotency" ON "progress_records" USING btree ("component_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_progress_component_time" ON "progress_records" USING btree ("component_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_project_members_project_user" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_user" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_code" ON "projects" USING btree ("code");
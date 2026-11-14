CREATE TYPE "public"."flow_account_status" AS ENUM('pending', 'active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."flow_approval_status" AS ENUM('pending', 'approved', 'rejected', 'revision_requested');--> statement-breakpoint
CREATE TYPE "public"."flow_file_category" AS ENUM('reference', 'original', 'edited', 'deliverable', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."flow_invoice_status" AS ENUM('draft', 'unpaid', 'partially_paid', 'pending', 'paid', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."flow_listing_status" AS ENUM('not_published', 'draft', 'ready_for_publishing', 'pending', 'published', 'rejected', 'needs_attention');--> statement-breakpoint
CREATE TYPE "public"."flow_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."flow_product_status" AS ENUM('submitted', 'initial_review', 'waiting_information', 'photography_scheduled', 'photography_in_progress', 'image_editing', 'content_creation', 'internal_quality_review', 'awaiting_client_approval', 'revision_requested', 'approved', 'ready_for_publishing', 'published', 'completed');--> statement-breakpoint
CREATE TYPE "public"."flow_project_status" AS ENUM('new', 'pending_review', 'waiting_client', 'in_progress', 'on_hold', 'awaiting_approval', 'revision_required', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."flow_service_request_status" AS ENUM('submitted', 'under_review', 'quotation_required', 'waiting_client_approval', 'approved', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."flow_subscription_status" AS ENUM('active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."flow_user_role" AS ENUM('client', 'admin', 'account_manager', 'photographer', 'content_creator', 'production_manager');--> statement-breakpoint
CREATE TABLE "flow_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_id" uuid,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" varchar(80),
	"action" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"visibility" varchar(16) DEFAULT 'client' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"product_id" uuid,
	"deliverable_id" uuid,
	"title" varchar(180) NOT NULL,
	"approval_type" varchar(60) NOT NULL,
	"status" "flow_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"responded_by" uuid,
	"client_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flow_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"organization_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" varchar(80),
	"previous_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"subject" varchar(180) NOT NULL,
	"assigned_user_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"product_id" uuid,
	"file_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"deliverable_type" varchar(60) NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "flow_employees" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"department" varchar(100),
	"title" varchar(120),
	"phone" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"product_id" uuid,
	"uploaded_by" uuid,
	"file_name" varchar(240) NOT NULL,
	"content_type" varchar(120) NOT NULL,
	"file_size" integer NOT NULL,
	"category" "flow_file_category" DEFAULT 'document' NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"client_visible" boolean DEFAULT true NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(240) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_number" varchar(40) NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"tax" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'EGP' NOT NULL,
	"status" "flow_invoice_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_marketplace_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"marketplace_id" uuid NOT NULL,
	"display_name" varchar(140),
	"external_account_id" varchar(180),
	"connection_status" varchar(30) DEFAULT 'not_connected' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"marketplace_id" uuid NOT NULL,
	"listing_id" varchar(180),
	"listing_url" text,
	"status" "flow_listing_status" DEFAULT 'not_published' NOT NULL,
	"published_at" timestamp with time zone,
	"error_message" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_marketplaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_marketplaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flow_message_attachments" (
	"message_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_message_attachments_message_id_file_id_pk" PRIMARY KEY("message_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "flow_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(60) DEFAULT 'update' NOT NULL,
	"href" varchar(300),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(180) NOT NULL,
	"contact_person" varchar(140) NOT NULL,
	"phone" varchar(40),
	"category" varchar(120),
	"website" varchar(300),
	"description" text,
	"preferred_language" varchar(8) DEFAULT 'en' NOT NULL,
	"target_marketplaces" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"required_services" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"monthly_product_estimate" integer,
	"additional_requirements" text,
	"status" "flow_account_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flow_password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "flow_payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"provider" varchar(60) NOT NULL,
	"provider_event_id" varchar(180),
	"event_type" varchar(100) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EGP' NOT NULL,
	"method" varchar(60) NOT NULL,
	"reference" varchar(180),
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "flow_product_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"language" varchar(8) NOT NULL,
	"title" text,
	"short_description" text,
	"full_description" text,
	"bullet_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"keywords" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(180) NOT NULL,
	"sku" varchar(100),
	"brand" varchar(120),
	"category" varchar(120),
	"product_type" varchar(100),
	"description" text,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight" varchar(60),
	"materials" text,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_audience" text,
	"target_marketplace" varchar(80),
	"required_services" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"client_instructions" text,
	"internal_notes" text,
	"status" "flow_product_status" DEFAULT 'submitted' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flow_project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"member_role" varchar(60) DEFAULT 'member' NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "flow_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_code" varchar(24) NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"account_manager_id" uuid,
	"status" "flow_project_status" DEFAULT 'new' NOT NULL,
	"priority" "flow_priority" DEFAULT 'normal' NOT NULL,
	"start_date" date,
	"due_date" date,
	"budget" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'EGP' NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flow_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "flow_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(60) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "flow_service_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text NOT NULL,
	"unit_type" varchar(40) DEFAULT 'project' NOT NULL,
	"price" numeric(12, 2),
	"price_label" varchar(80),
	"currency" varchar(3) DEFAULT 'EGP' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_service_catalog_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flow_service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"service_id" uuid,
	"project_name" varchar(180) NOT NULL,
	"product_quantity" integer DEFAULT 1 NOT NULL,
	"description" text,
	"target_marketplace" varchar(80),
	"desired_deadline" date,
	"priority" "flow_priority" DEFAULT 'normal' NOT NULL,
	"status" "flow_service_request_status" DEFAULT 'submitted' NOT NULL,
	"estimated_cost" numeric(12, 2),
	"assigned_to" uuid,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "flow_subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"billing_cycle" varchar(16) DEFAULT 'monthly' NOT NULL,
	"product_quota" integer,
	"included_services" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"overage_price" numeric(12, 2),
	"price" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'EGP' NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_subscription_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"products_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid,
	"status" "flow_subscription_status" DEFAULT 'active' NOT NULL,
	"billing_cycle" varchar(16) DEFAULT 'monthly' NOT NULL,
	"custom_price" numeric(12, 2),
	"starts_at" date,
	"renews_at" date,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"full_name" varchar(140) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "flow_user_role" DEFAULT 'client' NOT NULL,
	"status" "flow_account_status" DEFAULT 'pending' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flow_workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"stage_key" varchar(80) NOT NULL,
	"stage_label" varchar(120) NOT NULL,
	"stage_order" smallint NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"deadline" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"client_visible" boolean DEFAULT true NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flow_activity_logs" ADD CONSTRAINT "flow_activity_logs_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_activity_logs" ADD CONSTRAINT "flow_activity_logs_actor_id_flow_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_approvals" ADD CONSTRAINT "flow_approvals_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_approvals" ADD CONSTRAINT "flow_approvals_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_approvals" ADD CONSTRAINT "flow_approvals_product_id_flow_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."flow_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_approvals" ADD CONSTRAINT "flow_approvals_deliverable_id_flow_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."flow_deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_approvals" ADD CONSTRAINT "flow_approvals_requested_by_flow_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_approvals" ADD CONSTRAINT "flow_approvals_responded_by_flow_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_audit_logs" ADD CONSTRAINT "flow_audit_logs_actor_id_flow_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_audit_logs" ADD CONSTRAINT "flow_audit_logs_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_conversations" ADD CONSTRAINT "flow_conversations_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_conversations" ADD CONSTRAINT "flow_conversations_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_conversations" ADD CONSTRAINT "flow_conversations_assigned_user_id_flow_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_conversations" ADD CONSTRAINT "flow_conversations_created_by_flow_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_deliverables" ADD CONSTRAINT "flow_deliverables_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_deliverables" ADD CONSTRAINT "flow_deliverables_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_deliverables" ADD CONSTRAINT "flow_deliverables_product_id_flow_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."flow_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_deliverables" ADD CONSTRAINT "flow_deliverables_file_id_flow_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."flow_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_deliverables" ADD CONSTRAINT "flow_deliverables_created_by_flow_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_email_verification_tokens" ADD CONSTRAINT "flow_email_verification_tokens_user_id_flow_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flow_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_employees" ADD CONSTRAINT "flow_employees_user_id_flow_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flow_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_files" ADD CONSTRAINT "flow_files_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_files" ADD CONSTRAINT "flow_files_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_files" ADD CONSTRAINT "flow_files_product_id_flow_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."flow_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_files" ADD CONSTRAINT "flow_files_uploaded_by_flow_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_invoice_items" ADD CONSTRAINT "flow_invoice_items_invoice_id_flow_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."flow_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_invoices" ADD CONSTRAINT "flow_invoices_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_invoices" ADD CONSTRAINT "flow_invoices_created_by_flow_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_marketplace_accounts" ADD CONSTRAINT "flow_marketplace_accounts_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_marketplace_accounts" ADD CONSTRAINT "flow_marketplace_accounts_marketplace_id_flow_marketplaces_id_fk" FOREIGN KEY ("marketplace_id") REFERENCES "public"."flow_marketplaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_marketplace_listings" ADD CONSTRAINT "flow_marketplace_listings_product_id_flow_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."flow_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_marketplace_listings" ADD CONSTRAINT "flow_marketplace_listings_marketplace_id_flow_marketplaces_id_fk" FOREIGN KEY ("marketplace_id") REFERENCES "public"."flow_marketplaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_marketplace_listings" ADD CONSTRAINT "flow_marketplace_listings_updated_by_flow_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_message_attachments" ADD CONSTRAINT "flow_message_attachments_message_id_flow_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."flow_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_message_attachments" ADD CONSTRAINT "flow_message_attachments_file_id_flow_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."flow_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_messages" ADD CONSTRAINT "flow_messages_conversation_id_flow_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."flow_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_messages" ADD CONSTRAINT "flow_messages_sender_id_flow_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_notifications" ADD CONSTRAINT "flow_notifications_user_id_flow_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flow_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_password_reset_tokens" ADD CONSTRAINT "flow_password_reset_tokens_user_id_flow_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flow_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_payment_events" ADD CONSTRAINT "flow_payment_events_payment_id_flow_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."flow_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_payments" ADD CONSTRAINT "flow_payments_invoice_id_flow_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."flow_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_payments" ADD CONSTRAINT "flow_payments_verified_by_flow_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_product_contents" ADD CONSTRAINT "flow_product_contents_product_id_flow_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."flow_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_product_contents" ADD CONSTRAINT "flow_product_contents_created_by_flow_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_products" ADD CONSTRAINT "flow_products_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_products" ADD CONSTRAINT "flow_products_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_products" ADD CONSTRAINT "flow_products_created_by_flow_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_project_members" ADD CONSTRAINT "flow_project_members_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_project_members" ADD CONSTRAINT "flow_project_members_user_id_flow_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flow_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_project_members" ADD CONSTRAINT "flow_project_members_assigned_by_flow_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_projects" ADD CONSTRAINT "flow_projects_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_projects" ADD CONSTRAINT "flow_projects_account_manager_id_flow_users_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_projects" ADD CONSTRAINT "flow_projects_created_by_flow_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_role_permissions" ADD CONSTRAINT "flow_role_permissions_role_id_flow_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."flow_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_role_permissions" ADD CONSTRAINT "flow_role_permissions_permission_id_flow_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."flow_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_service_requests" ADD CONSTRAINT "flow_service_requests_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_service_requests" ADD CONSTRAINT "flow_service_requests_project_id_flow_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."flow_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_service_requests" ADD CONSTRAINT "flow_service_requests_service_id_flow_service_catalog_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."flow_service_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_service_requests" ADD CONSTRAINT "flow_service_requests_assigned_to_flow_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_service_requests" ADD CONSTRAINT "flow_service_requests_requested_by_flow_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_sessions" ADD CONSTRAINT "flow_sessions_user_id_flow_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flow_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_subscription_usage" ADD CONSTRAINT "flow_subscription_usage_subscription_id_flow_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."flow_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_subscriptions" ADD CONSTRAINT "flow_subscriptions_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_subscriptions" ADD CONSTRAINT "flow_subscriptions_plan_id_flow_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."flow_subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_users" ADD CONSTRAINT "flow_users_organization_id_flow_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."flow_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_workflow_steps" ADD CONSTRAINT "flow_workflow_steps_product_id_flow_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."flow_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_workflow_steps" ADD CONSTRAINT "flow_workflow_steps_assigned_to_flow_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."flow_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_activity_org_time_idx" ON "flow_activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "flow_activity_entity_idx" ON "flow_activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "flow_approvals_org_status_idx" ON "flow_approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "flow_approvals_product_idx" ON "flow_approvals" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "flow_audit_actor_time_idx" ON "flow_audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "flow_audit_entity_idx" ON "flow_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "flow_conversations_org_idx" ON "flow_conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "flow_conversations_assignee_idx" ON "flow_conversations" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "flow_deliverables_org_idx" ON "flow_deliverables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "flow_deliverables_product_idx" ON "flow_deliverables" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "flow_email_verify_user_idx" ON "flow_email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flow_files_org_created_idx" ON "flow_files" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "flow_files_product_idx" ON "flow_files" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "flow_invoice_items_invoice_idx" ON "flow_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_invoice_number_unique" ON "flow_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "flow_invoices_org_status_idx" ON "flow_invoices" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_marketplace_account_unique" ON "flow_marketplace_accounts" USING btree ("organization_id","marketplace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_listing_product_market_unique" ON "flow_marketplace_listings" USING btree ("product_id","marketplace_id");--> statement-breakpoint
CREATE INDEX "flow_listing_status_idx" ON "flow_marketplace_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flow_message_attachments_file_idx" ON "flow_message_attachments" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "flow_messages_conversation_time_idx" ON "flow_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "flow_notifications_user_unread_idx" ON "flow_notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "flow_organizations_status_idx" ON "flow_organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flow_password_reset_user_idx" ON "flow_password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_payment_provider_event_unique" ON "flow_payment_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "flow_payments_invoice_idx" ON "flow_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "flow_payments_status_idx" ON "flow_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_product_content_version_unique" ON "flow_product_contents" USING btree ("product_id","version","language");--> statement-breakpoint
CREATE INDEX "flow_product_content_product_idx" ON "flow_product_contents" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "flow_products_org_status_idx" ON "flow_products" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "flow_products_project_idx" ON "flow_products" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "flow_products_sku_idx" ON "flow_products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "flow_products_created_idx" ON "flow_products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "flow_project_members_user_idx" ON "flow_project_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_projects_code_unique" ON "flow_projects" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "flow_projects_org_status_idx" ON "flow_projects" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "flow_projects_manager_idx" ON "flow_projects" USING btree ("account_manager_id");--> statement-breakpoint
CREATE INDEX "flow_projects_due_idx" ON "flow_projects" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "flow_service_catalog_enabled_idx" ON "flow_service_catalog" USING btree ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "flow_service_requests_org_status_idx" ON "flow_service_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "flow_sessions_user_idx" ON "flow_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flow_sessions_expiry_idx" ON "flow_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_usage_period_unique" ON "flow_subscription_usage" USING btree ("subscription_id","period_start");--> statement-breakpoint
CREATE INDEX "flow_subscriptions_org_status_idx" ON "flow_subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_users_email_unique" ON "flow_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "flow_users_org_idx" ON "flow_users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "flow_users_role_status_idx" ON "flow_users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "flow_workflow_product_order_idx" ON "flow_workflow_steps" USING btree ("product_id","stage_order");--> statement-breakpoint
CREATE INDEX "flow_workflow_assignee_idx" ON "flow_workflow_steps" USING btree ("assigned_to");
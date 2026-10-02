CREATE TYPE "public"."client_status" AS ENUM('DRAFT', 'ACTIVE', 'SUBMITTED', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('UPLOADED', 'VERIFIED', 'REJECTED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."identity_request_status" AS ENUM('PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('DRAFT', 'SUBMITTED', 'UPDATED', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."response_type" AS ENUM('MESSAGE', 'MORE_INFO_REQUEST', 'INTERESTED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('DRAFT', 'PENDING_DELIVERY', 'SENT', 'DELIVERED', 'DELIVERY_FAILED', 'OPENED', 'IN_REVIEW', 'MORE_INFO_REQUESTED', 'IDENTITY_REQUESTED', 'IDENTITY_APPROVED', 'IDENTITY_REJECTED', 'OFFER_RECEIVED', 'DECLINED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'LENDER_ADMIN', 'LENDER_UNDERWRITER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');--> statement-breakpoint
CREATE TABLE "advisor_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"business_name" varchar(200),
	"license_number" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_characters" integer NOT NULL,
	"status" varchar(40) NOT NULL,
	"duration_ms" integer,
	"sanitized_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80),
	"entity_id" integer,
	"metadata" jsonb,
	"request_id" varchar(64),
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowers" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"borrower_type" varchar(20) NOT NULL,
	"full_name_encrypted" text NOT NULL,
	"identity_number_encrypted" text NOT NULL,
	"birth_date" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_case_number" varchar(32) NOT NULL,
	"advisor_id" integer NOT NULL,
	"status" "client_status" DEFAULT 'DRAFT' NOT NULL,
	"first_name_encrypted" text NOT NULL,
	"last_name_encrypted" text NOT NULL,
	"identity_number_encrypted" text NOT NULL,
	"phone_encrypted" text NOT NULL,
	"email_encrypted" text NOT NULL,
	"address_encrypted" text,
	"notes_encrypted" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_public_case_number_unique" UNIQUE("public_case_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"uploaded_by_user_id" integer NOT NULL,
	"document_type" varchar(80) NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"status" "document_status" DEFAULT 'UPLOADED' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer,
	"recipient" varchar(320) NOT NULL,
	"message_id" varchar(255),
	"status" varchar(40) NOT NULL,
	"sanitized_error" text,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"borrower_id" integer NOT NULL,
	"employment_type" varchar(30) NOT NULL,
	"employer_name_encrypted" text,
	"job_title" varchar(150),
	"monthly_net_income" numeric(14, 2) NOT NULL,
	"start_date" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_reveal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"reason" text NOT NULL,
	"requested_fields" jsonb NOT NULL,
	"approved_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approved_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "identity_request_status" DEFAULT 'PENDING' NOT NULL,
	"decided_by_user_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"borrower_id" integer NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"monthly_amount" numeric(14, 2) NOT NULL,
	"description_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_invite_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_user_id" integer,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"response_type" "response_type" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"lender_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"status" "submission_status" DEFAULT 'DRAFT' NOT NULL,
	"anonymous_snapshot" jsonb NOT NULL,
	"anonymous_pdf_storage_key" varchar(512),
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"lender_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lenders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lenders_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "liabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"liability_type" varchar(50) NOT NULL,
	"outstanding_balance" numeric(14, 2) NOT NULL,
	"monthly_payment" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"lender_user_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(7, 4) NOT NULL,
	"term_months" integer NOT NULL,
	"monthly_payment" numeric(14, 2),
	"conditions" text,
	"status" "offer_status" DEFAULT 'SUBMITTED' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"requested_amount" numeric(14, 2) NOT NULL,
	"requested_term_months" integer NOT NULL,
	"loan_to_value" numeric(6, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(80) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"property_type" varchar(50) NOT NULL,
	"region" varchar(100) NOT NULL,
	"city" varchar(100),
	"address_encrypted" text,
	"estimated_value" numeric(14, 2) NOT NULL,
	"existing_mortgage_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(120) NOT NULL,
	"value" text,
	"category" varchar(60) NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(320) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone_encrypted" text,
	"role" "user_role" NOT NULL,
	"role_label" varchar(100) NOT NULL,
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"deleted_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "advisor_profiles" ADD CONSTRAINT "advisor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_logs" ADD CONSTRAINT "ai_analysis_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_logs" ADD CONSTRAINT "ai_analysis_logs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_advisor_id_advisor_profiles_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reveal_requests" ADD CONSTRAINT "identity_reveal_requests_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reveal_requests" ADD CONSTRAINT "identity_reveal_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reveal_requests" ADD CONSTRAINT "identity_reveal_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_invite_tokens" ADD CONSTRAINT "lender_invite_tokens_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_invite_tokens" ADD CONSTRAINT "lender_invite_tokens_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_responses" ADD CONSTRAINT "lender_responses_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_responses" ADD CONSTRAINT "lender_responses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_users" ADD CONSTRAINT "lender_users_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_users" ADD CONSTRAINT "lender_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_lender_user_id_users_id_fk" FOREIGN KEY ("lender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advisor_profiles_user_id_uq" ON "advisor_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "borrowers_client_idx" ON "borrowers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "clients_advisor_idx" ON "clients" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "clients_deleted_idx" ON "clients" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_token_hash_uq" ON "lender_invite_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invite_submission_idx" ON "lender_invite_tokens" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_client_idx" ON "lender_submissions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "submissions_lender_idx" ON "lender_submissions" USING btree ("lender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lender_users_lender_user_uq" ON "lender_users" USING btree ("lender_id","user_id");--> statement-breakpoint
CREATE INDEX "lender_users_user_idx" ON "lender_users" USING btree ("user_id");
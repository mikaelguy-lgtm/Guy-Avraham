CREATE TYPE "public"."client_status" AS ENUM('DRAFT', 'ACTIVE', 'READY_FOR_SUBMISSION', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('UPLOADING', 'UPLOADED', 'PROCESSING', 'VERIFIED', 'REJECTED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('DRAFT', 'SUBMITTED', 'UPDATED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."response_type" AS ENUM('INTERESTED', 'NOT_INTERESTED', 'REQUEST_MORE_INFORMATION', 'REQUEST_IDENTITY_REVEAL', 'GENERAL_MESSAGE');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('DRAFT', 'SENT', 'DELIVERED', 'OPENED', 'IN_REVIEW', 'MORE_INFO_REQUESTED', 'IDENTITY_REQUESTED', 'IDENTITY_APPROVED', 'IDENTITY_REJECTED', 'OFFER_RECEIVED', 'DECLINED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'LENDER_ADMIN', 'LENDER_UNDERWRITER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED');--> statement-breakpoint
CREATE TABLE "advisor_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"business_name" text,
	"license_number" text,
	"business_phone" text,
	"business_email" text,
	"address" text,
	"logo_storage_key" text,
	"disable_gemini" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "advisor_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"analysis_type" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text,
	"status" text NOT NULL,
	"token_usage" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "borrowers" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"borrower_type" text DEFAULT 'PRIMARY' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"identity_number_encrypted" text,
	"identity_number_hash" text,
	"identity_number_last4" text,
	"birth_date" text,
	"phone_encrypted" text,
	"email_encrypted" text,
	"relationship_to_primary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"advisor_id" integer NOT NULL,
	"case_number" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"identity_number_encrypted" text,
	"identity_number_hash" text,
	"identity_number_last4" text,
	"birth_date" text,
	"phone_encrypted" text,
	"email_encrypted" text,
	"marital_status" text,
	"number_of_children" integer DEFAULT 0,
	"city" text,
	"address_encrypted" text,
	"notes_encrypted" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "clients_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"borrower_id" integer,
	"document_type" text NOT NULL,
	"original_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"status" text DEFAULT 'UPLOADED' NOT NULL,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp,
	"verified_by_user_id" integer,
	"verified_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"template" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" integer,
	"provider_message_id" text,
	"status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employment_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"borrower_id" integer NOT NULL,
	"employment_type" text,
	"employer_name_encrypted" text,
	"job_title" text,
	"start_date" text,
	"monthly_net_income" numeric(12, 2) DEFAULT '0',
	"monthly_gross_income" numeric(12, 2) DEFAULT '0',
	"additional_income" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "identity_reveal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"requested_fields" text,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_user_id" integer,
	"reviewed_at" timestamp,
	"approved_fields" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "income_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"borrower_id" integer NOT NULL,
	"income_type" text NOT NULL,
	"description" text,
	"monthly_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_fixed" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lender_invite_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lender_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"lender_user_id" integer NOT NULL,
	"response_type" text NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lender_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"advisor_id" integer NOT NULL,
	"lender_id" integer NOT NULL,
	"status" text DEFAULT 'SENT' NOT NULL,
	"anonymous_snapshot" text,
	"sent_at" timestamp DEFAULT now(),
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"identity_requested_at" timestamp,
	"identity_approved_at" timestamp,
	"identity_rejected_at" timestamp,
	"identity_approved_by_user_id" integer,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lender_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lender_id" integer NOT NULL,
	"job_title" text,
	"is_primary_contact" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lender_users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "lenders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"company_number" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"website" text,
	"general_email" text,
	"phone" text,
	"logo_storage_key" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "liabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"liability_type" text NOT NULL,
	"institution" text,
	"original_amount" numeric(12, 2) DEFAULT '0',
	"current_balance" numeric(12, 2) DEFAULT '0',
	"monthly_payment" numeric(12, 2) DEFAULT '0',
	"interest_rate" numeric(5, 2),
	"end_date" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "loan_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"lender_id" integer NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"interest_type" text NOT NULL,
	"linked_to_index" text,
	"term_months" integer NOT NULL,
	"monthly_payment" numeric(12, 2),
	"origination_fee" numeric(12, 2) DEFAULT '0',
	"additional_fees" numeric(12, 2) DEFAULT '0',
	"conditions" text,
	"valid_until" timestamp,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"purpose" text,
	"requested_amount" numeric(12, 2) DEFAULT '0',
	"requested_term_months" integer,
	"requested_monthly_payment" numeric(12, 2) DEFAULT '0',
	"loan_to_value" numeric(5, 2),
	"notes" text,
	"status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"property_type" text,
	"city" text,
	"address_encrypted" text,
	"estimated_value" numeric(12, 2) DEFAULT '0',
	"purchase_price" numeric(12, 2) DEFAULT '0',
	"existing_mortgage_balance" numeric(12, 2) DEFAULT '0',
	"ownership_percentage" numeric(5, 2) DEFAULT '100.00',
	"registration_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"value_type" text DEFAULT 'text' NOT NULL,
	"category" text DEFAULT 'GENERAL' NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"role" text DEFAULT 'ADVISOR' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"email_verified" boolean DEFAULT false,
	"last_login_at" timestamp,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "advisor_profiles" ADD CONSTRAINT "advisor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_logs" ADD CONSTRAINT "ai_analysis_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_logs" ADD CONSTRAINT "ai_analysis_logs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reveal_requests" ADD CONSTRAINT "identity_reveal_requests_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reveal_requests" ADD CONSTRAINT "identity_reveal_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reveal_requests" ADD CONSTRAINT "identity_reveal_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_invite_tokens" ADD CONSTRAINT "lender_invite_tokens_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_responses" ADD CONSTRAINT "lender_responses_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_responses" ADD CONSTRAINT "lender_responses_lender_user_id_users_id_fk" FOREIGN KEY ("lender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_identity_approved_by_user_id_users_id_fk" FOREIGN KEY ("identity_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_users" ADD CONSTRAINT "lender_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_users" ADD CONSTRAINT "lender_users_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_submission_id_lender_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."lender_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "borrowers_client_id_idx" ON "borrowers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "clients_advisor_id_idx" ON "clients" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "clients_case_number_idx" ON "clients" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_identity_number_hash_idx" ON "clients" USING btree ("identity_number_hash");--> statement-breakpoint
CREATE INDEX "clients_created_at_idx" ON "clients" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_client_id_idx" ON "documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "documents_borrower_id_idx" ON "documents" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "identity_reveal_requests_sub_id_idx" ON "identity_reveal_requests" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "identity_reveal_requests_status_idx" ON "identity_reveal_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lender_responses_sub_id_idx" ON "lender_responses" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "lender_submissions_client_id_idx" ON "lender_submissions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "lender_submissions_advisor_id_idx" ON "lender_submissions" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "lender_submissions_lender_id_idx" ON "lender_submissions" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "lender_submissions_status_idx" ON "lender_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lender_submissions_created_at_idx" ON "lender_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lender_users_user_id_idx" ON "lender_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lender_users_lender_id_idx" ON "lender_users" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "loan_offers_sub_id_idx" ON "loan_offers" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "loan_offers_lender_id_idx" ON "loan_offers" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "loan_offers_status_idx" ON "loan_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");
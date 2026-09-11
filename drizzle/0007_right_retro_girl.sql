CREATE TYPE "public"."business_calendar_exception_type" AS ENUM('HOLIDAY', 'NON_WORKING_DAY', 'FORCED_WORKING_DAY');--> statement-breakpoint
CREATE TYPE "public"."case_version_status" AS ENUM('CREATING', 'READY', 'FAILED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."company_access_status" AS ENUM('NONE', 'ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."company_decision_status" AS ENUM('PENDING', 'PENDING_VERIFICATION', 'INTERESTED', 'NOT_INTERESTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."company_delivery_status" AS ENUM('PENDING', 'QUEUED', 'PARTIALLY_SENT', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."contact_invitation_status" AS ENUM('PENDING', 'QUEUED', 'SENT', 'FAILED', 'OPENED', 'CLOSED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('INTEREST_DECISION', 'PORTAL_ACCESS');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."submission_actor_type" AS ENUM('ADVISOR', 'ADMIN', 'COMPANY_CONTACT', 'SYSTEM');--> statement-breakpoint
CREATE TABLE "business_calendar_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"exception_date" date NOT NULL,
	"type" "business_calendar_exception_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"source" varchar(200) NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_version_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_version_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"immutable_object_key" varchar(512) NOT NULL,
	"document_type" varchar(80) NOT NULL,
	"custom_title" varchar(255),
	"borrower_id" integer,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_version_documents_immutable_object_key_unique" UNIQUE("immutable_object_key")
);
--> statement-breakpoint
CREATE TABLE "case_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"advisor_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"source_client_updated_at" timestamp with time zone NOT NULL,
	"full_snapshot_encrypted" text NOT NULL,
	"masked_snapshot" jsonb NOT NULL,
	"masked_pdf_object_key" varchar(512) NOT NULL,
	"full_pdf_object_key" varchar(512) NOT NULL,
	"redaction_report" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"status" "case_version_status" DEFAULT 'CREATING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_portal_access_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_submission_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"access_token_hash" varchar(64) NOT NULL,
	"token_nonce" varchar(100) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"first_authenticated_at" timestamp with time zone,
	"last_authenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_portal_access_grants_access_token_hash_unique" UNIQUE("access_token_hash")
);
--> statement-breakpoint
CREATE TABLE "company_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" varchar(64) NOT NULL,
	"case_version_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"advisor_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"delivery_status" "company_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"decision_status" "company_decision_status" DEFAULT 'PENDING' NOT NULL,
	"access_status" "company_access_status" DEFAULT 'NONE' NOT NULL,
	"response_deadline_at" timestamp with time zone NOT NULL,
	"decision_contact_id" integer,
	"decision_at" timestamp with time zone,
	"full_access_starts_at" timestamp with time zone,
	"full_access_expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_submissions_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"advisor_id" integer NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"template" varchar(100) NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"message_id" varchar(255),
	"sanitized_error" varchar(200),
	"company_submission_id" integer,
	"invitation_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "external_portal_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"access_grant_id" integer NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_portal_sessions_session_token_hash_unique" UNIQUE("session_token_hash")
);
--> statement-breakpoint
CREATE TABLE "lender_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lender_id" integer NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role_title" varchar(150) NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_normalized" varchar(320) NOT NULL,
	"phone" varchar(50),
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"company_submission_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"invitation_id" integer,
	"access_grant_id" integer,
	"code_hash" varchar(64) NOT NULL,
	"code_nonce" varchar(100) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"used_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_contact_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" varchar(64) NOT NULL,
	"company_submission_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_nonce" varchar(100) NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"status" "contact_invitation_status" DEFAULT 'PENDING' NOT NULL,
	"email_queued_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"email_failed_at" timestamp with time zone,
	"email_failure_reason" varchar(200),
	"opened_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"open_count" integer DEFAULT 0 NOT NULL,
	"masked_pdf_viewed_at" timestamp with time zone,
	"masked_pdf_downloaded_at" timestamp with time zone,
	"reminder_one_sent_at" timestamp with time zone,
	"reminder_two_sent_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_contact_invitations_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "submission_contact_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "submission_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_submission_id" integer NOT NULL,
	"contact_invitation_id" integer,
	"contact_id" integer,
	"actor_type" "submission_actor_type" NOT NULL,
	"actor_id" integer,
	"event_type" varchar(100) NOT NULL,
	"metadata_safe" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" varchar(64),
	"user_agent_summary" varchar(255),
	"request_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lenders" ALTER COLUMN "contact_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "legal_name" varchar(250);--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "company_number" varchar(50);--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "logo_storage_key" varchar(512);--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "website" varchar(500);--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "activity_areas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "admin_notes_encrypted" text;--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
INSERT INTO "lender_contacts" ("lender_id", "first_name", "last_name", "role_title", "email", "email_normalized", "is_primary", "active")
SELECT "id", 'איש קשר', 'ראשי', 'איש קשר ראשי', lower(trim("contact_email")), lower(trim("contact_email")), true, "active"
FROM "lenders"
WHERE "contact_email" IS NOT NULL AND trim("contact_email") <> '';--> statement-breakpoint
ALTER TABLE "business_calendar_exceptions" ADD CONSTRAINT "business_calendar_exceptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_version_documents" ADD CONSTRAINT "case_version_documents_case_version_id_case_versions_id_fk" FOREIGN KEY ("case_version_id") REFERENCES "public"."case_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_version_documents" ADD CONSTRAINT "case_version_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_version_documents" ADD CONSTRAINT "case_version_documents_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_versions" ADD CONSTRAINT "case_versions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_versions" ADD CONSTRAINT "case_versions_advisor_id_advisor_profiles_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_versions" ADD CONSTRAINT "case_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_portal_access_grants" ADD CONSTRAINT "company_portal_access_grants_company_submission_id_company_submissions_id_fk" FOREIGN KEY ("company_submission_id") REFERENCES "public"."company_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_portal_access_grants" ADD CONSTRAINT "company_portal_access_grants_contact_id_lender_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lender_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD CONSTRAINT "company_submissions_case_version_id_case_versions_id_fk" FOREIGN KEY ("case_version_id") REFERENCES "public"."case_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD CONSTRAINT "company_submissions_company_id_lenders_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD CONSTRAINT "company_submissions_advisor_id_advisor_profiles_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD CONSTRAINT "company_submissions_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD CONSTRAINT "company_submissions_decision_contact_id_lender_contacts_id_fk" FOREIGN KEY ("decision_contact_id") REFERENCES "public"."lender_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_advisor_id_advisor_profiles_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_company_submission_id_company_submissions_id_fk" FOREIGN KEY ("company_submission_id") REFERENCES "public"."company_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_invitation_id_submission_contact_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."submission_contact_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_portal_sessions" ADD CONSTRAINT "external_portal_sessions_access_grant_id_company_portal_access_grants_id_fk" FOREIGN KEY ("access_grant_id") REFERENCES "public"."company_portal_access_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_contacts" ADD CONSTRAINT "lender_contacts_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_company_submission_id_company_submissions_id_fk" FOREIGN KEY ("company_submission_id") REFERENCES "public"."company_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_contact_id_lender_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lender_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_invitation_id_submission_contact_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."submission_contact_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_access_grant_id_company_portal_access_grants_id_fk" FOREIGN KEY ("access_grant_id") REFERENCES "public"."company_portal_access_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_contact_invitations" ADD CONSTRAINT "submission_contact_invitations_company_submission_id_company_submissions_id_fk" FOREIGN KEY ("company_submission_id") REFERENCES "public"."company_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_contact_invitations" ADD CONSTRAINT "submission_contact_invitations_contact_id_lender_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lender_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_company_submission_id_company_submissions_id_fk" FOREIGN KEY ("company_submission_id") REFERENCES "public"."company_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_contact_invitation_id_submission_contact_invitations_id_fk" FOREIGN KEY ("contact_invitation_id") REFERENCES "public"."submission_contact_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_contact_id_lender_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lender_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_calendar_date_uq" ON "business_calendar_exceptions" USING btree ("exception_date");--> statement-breakpoint
CREATE UNIQUE INDEX "case_version_documents_version_document_uq" ON "case_version_documents" USING btree ("case_version_id","document_id");--> statement-breakpoint
CREATE INDEX "case_version_documents_version_idx" ON "case_version_documents" USING btree ("case_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_versions_client_version_uq" ON "case_versions" USING btree ("client_id","version_number");--> statement-breakpoint
CREATE INDEX "case_versions_client_idx" ON "case_versions" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_portal_grant_contact_uq" ON "company_portal_access_grants" USING btree ("company_submission_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_submissions_version_company_uq" ON "company_submissions" USING btree ("case_version_id","company_id");--> statement-breakpoint
CREATE INDEX "company_submissions_client_status_idx" ON "company_submissions" USING btree ("advisor_id","decision_status");--> statement-breakpoint
CREATE INDEX "company_submissions_deadline_idx" ON "company_submissions" USING btree ("decision_status","response_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_batches_advisor_idempotency_uq" ON "delivery_batches" USING btree ("advisor_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "external_portal_sessions_grant_idx" ON "external_portal_sessions" USING btree ("access_grant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lender_contacts_email_uq" ON "lender_contacts" USING btree ("lender_id","email_normalized") WHERE "lender_contacts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "lender_contacts_active_idx" ON "lender_contacts" USING btree ("lender_id","active","deleted_at");--> statement-breakpoint
CREATE INDEX "otp_challenges_active_idx" ON "otp_challenges" USING btree ("company_submission_id","contact_id","purpose","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_contact_invitation_uq" ON "submission_contact_invitations" USING btree ("company_submission_id","contact_id");--> statement-breakpoint
CREATE INDEX "submission_contact_token_idx" ON "submission_contact_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "submission_events_submission_idx" ON "submission_events" USING btree ("company_submission_id","created_at");

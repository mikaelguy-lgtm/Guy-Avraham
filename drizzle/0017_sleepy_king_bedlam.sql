CREATE TYPE "public"."privacy_request_status" AS ENUM('NEW', 'IN_REVIEW', 'IDENTITY_VERIFICATION_REQUIRED', 'APPROVED', 'REJECTED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_type" AS ENUM('VIEW', 'CORRECTION', 'DELETION', 'ACCOUNT_CLOSURE', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."legal_document_type" ADD VALUE 'DPA';--> statement-breakpoint
CREATE TABLE "privacy_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" "privacy_request_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"description" text,
	"status" "privacy_request_status" DEFAULT 'NEW' NOT NULL,
	"internal_notes" text,
	"handled_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_handled_by_user_id_users_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "privacy_requests_status_idx" ON "privacy_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "privacy_requests_created_idx" ON "privacy_requests" USING btree ("created_at");
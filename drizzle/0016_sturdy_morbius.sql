CREATE TYPE "public"."legal_document_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."legal_document_type" AS ENUM('TERMS', 'PRIVACY');--> statement-breakpoint
CREATE TABLE "legal_document_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" "legal_document_type" NOT NULL,
	"legal_document_version_id" integer NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" varchar(64),
	"user_agent_summary" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "legal_document_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" "legal_document_type" NOT NULL,
	"version_number" integer NOT NULL,
	"status" "legal_document_status" DEFAULT 'DRAFT' NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(32),
	"contact_address" varchar(300),
	"effective_date" date,
	"content_hash" varchar(64),
	"created_by_user_id" integer NOT NULL,
	"published_by_user_id" integer,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_document_acceptances" ADD CONSTRAINT "legal_document_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_acceptances" ADD CONSTRAINT "legal_document_acceptances_legal_document_version_id_legal_document_versions_id_fk" FOREIGN KEY ("legal_document_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_document_acceptances_user_idx" ON "legal_document_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "legal_document_acceptances_version_idx" ON "legal_document_acceptances" USING btree ("legal_document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_acceptances_user_type_version_uq" ON "legal_document_acceptances" USING btree ("user_id","document_type","legal_document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_versions_type_version_uq" ON "legal_document_versions" USING btree ("document_type","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_versions_one_published_uq" ON "legal_document_versions" USING btree ("document_type") WHERE "legal_document_versions"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_versions_one_draft_uq" ON "legal_document_versions" USING btree ("document_type") WHERE "legal_document_versions"."status" = 'DRAFT';--> statement-breakpoint
CREATE INDEX "legal_document_versions_type_status_idx" ON "legal_document_versions" USING btree ("document_type","status");
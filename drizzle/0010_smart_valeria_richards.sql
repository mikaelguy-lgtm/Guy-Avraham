CREATE TYPE "public"."email_configuration_status" AS ENUM('DRAFT', 'TESTED', 'ACTIVE', 'FAILED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('GMAIL', 'BREVO', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."email_security_mode" AS ENUM('NONE', 'STARTTLS', 'TLS');--> statement-breakpoint
CREATE TABLE "email_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "email_provider" NOT NULL,
	"status" "email_configuration_status" DEFAULT 'DRAFT' NOT NULL,
	"host" varchar(253) NOT NULL,
	"port" integer NOT NULL,
	"security_mode" "email_security_mode" NOT NULL,
	"username" varchar(320),
	"from_email" varchar(320) NOT NULL,
	"from_name" varchar(200) NOT NULL,
	"reply_to" varchar(320) NOT NULL,
	"secret_name" varchar(120),
	"secret_version" varchar(512),
	"previous_configuration_id" integer,
	"last_tested_at" timestamp with time zone,
	"last_test_failure_code" varchar(80),
	"activated_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_configurations" ADD CONSTRAINT "email_configurations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_configurations" ADD CONSTRAINT "email_configurations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_configurations_status_idx" ON "email_configurations" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_configurations_single_active_uq" ON "email_configurations" USING btree ("status") WHERE "email_configurations"."status" = 'ACTIVE';
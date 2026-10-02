ALTER TABLE "advisor_profiles" ADD COLUMN "business_phone_encrypted" text;--> statement-breakpoint
ALTER TABLE "advisor_profiles" ADD COLUMN "business_email" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "email_verified" = true WHERE "status" = 'ACTIVE';--> statement-breakpoint
UPDATE "advisor_profiles" SET "business_email" = "users"."email" FROM "users" WHERE "advisor_profiles"."user_id" = "users"."id" AND "advisor_profiles"."business_email" IS NULL;

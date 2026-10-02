ALTER TABLE "email_logs" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "template" varchar(100);--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "request_id" varchar(64);--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
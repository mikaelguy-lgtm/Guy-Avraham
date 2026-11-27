ALTER TABLE "notifications" ADD COLUMN "entity_type" varchar(80);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "entity_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "idempotency_key" varchar(160);--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key_idx" ON "notifications" USING btree ("idempotency_key");
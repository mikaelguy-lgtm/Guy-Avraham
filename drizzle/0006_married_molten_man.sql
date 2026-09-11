ALTER TYPE "public"."document_status" ADD VALUE 'REPLACED' BEFORE 'DELETED';--> statement-breakpoint
ALTER TABLE "liabilities" DROP CONSTRAINT "liabilities_amounts_check";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "deal_details_encrypted" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "deal_details_updated_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "deal_details_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "borrower_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "custom_title" varchar(255);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "description_encrypted" text;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "scope" varchar(20) DEFAULT 'BORROWER' NOT NULL;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "current_balance" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "other_type_description_encrypted" text;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "notes_encrypted" text;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "legacy_status" varchar(30);--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "clients"
SET "deal_details_encrypted" = "notes_encrypted",
    "deal_details_updated_at" = "updated_at"
WHERE "deal_details_encrypted" IS NULL;--> statement-breakpoint
INSERT INTO "liabilities" (
  "client_id", "borrower_id", "scope", "liability_type", "outstanding_balance", "current_balance",
  "monthly_payment", "legacy_status", "created_at", "updated_at"
)
SELECT
  liability."client_id", NULL, 'HOUSEHOLD',
  CASE WHEN liability."liability_type" = 'OTHER' THEN 'OTHER_FINANCIAL_ENTITY' ELSE liability."liability_type" END,
  SUM(liability."outstanding_balance"), SUM(liability."outstanding_balance"), SUM(liability."monthly_payment"),
  'INCOMPLETE_LEGACY', MIN(liability."created_at"), MAX(liability."updated_at")
FROM "liabilities" liability
INNER JOIN "clients" client ON client."id" = liability."client_id"
WHERE client."borrower_relationship" = 'MARRIED' AND liability."borrower_id" IS NOT NULL
GROUP BY liability."client_id", CASE WHEN liability."liability_type" = 'OTHER' THEN 'OTHER_FINANCIAL_ENTITY' ELSE liability."liability_type" END;--> statement-breakpoint
DELETE FROM "liabilities" liability
USING "clients" client
WHERE client."id" = liability."client_id"
  AND client."borrower_relationship" = 'MARRIED'
  AND liability."borrower_id" IS NOT NULL;--> statement-breakpoint
UPDATE "liabilities"
SET "scope" = CASE WHEN "borrower_id" IS NULL THEN 'HOUSEHOLD' ELSE 'BORROWER' END,
    "liability_type" = CASE WHEN "liability_type" = 'OTHER' THEN 'OTHER_FINANCIAL_ENTITY' ELSE "liability_type" END,
    "current_balance" = COALESCE("current_balance", "outstanding_balance"),
    "legacy_status" = COALESCE("legacy_status", 'INCOMPLETE_LEGACY');--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_deal_details_updated_by_user_id_users_id_fk" FOREIGN KEY ("deal_details_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_borrower_idx" ON "documents" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "documents_required_lookup_idx" ON "documents" USING btree ("client_id","borrower_id","document_type","status");--> statement-breakpoint
CREATE INDEX "liabilities_client_idx" ON "liabilities" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "liabilities_active_idx" ON "liabilities" USING btree ("client_id","deleted_at");--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_scope_check" CHECK (("liabilities"."scope" = 'BORROWER' and "liabilities"."borrower_id" is not null) or ("liabilities"."scope" = 'HOUSEHOLD' and "liabilities"."borrower_id" is null));--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_type_check" CHECK ("liabilities"."liability_type" in ('LOAN', 'MORTGAGE', 'ALIMONY', 'OTHER_FINANCIAL_ENTITY'));--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_amounts_check" CHECK ("liabilities"."outstanding_balance" >= 0 and "liabilities"."monthly_payment" >= 0 and ("liabilities"."current_balance" is null or "liabilities"."current_balance" >= 0));--> statement-breakpoint
ALTER TABLE "loan_requests" DROP CONSTRAINT IF EXISTS "loan_requests_purpose_check";--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_purpose_check" CHECK ("loan_requests"."purpose" in ('PURCHASE_FROM_CONTRACTOR', 'BUYER_PRICE_PROGRAM', 'SECOND_HAND_PURCHASE', 'RENOVATION', 'DEBT_CONSOLIDATION', 'BUSINESS_PURPOSE', 'ANY_PURPOSE', 'SELF_CONSTRUCTION', 'FAMILY_TRANSACTION', 'KIBBUTZ_PURCHASE_OR_CONSTRUCTION', 'RECEIVER_PURCHASE', 'REVERSE_MORTGAGE', 'TAMA', 'MORTGAGE_REFINANCE', 'BRIDGE_FINANCING'));

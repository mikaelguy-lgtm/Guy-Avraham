ALTER TABLE "employment_records" DROP CONSTRAINT "employment_type_check";--> statement-breakpoint
ALTER TABLE "employment_records" DROP CONSTRAINT "employment_additional_type_check";--> statement-breakpoint
ALTER TABLE "employment_records" DROP CONSTRAINT "employment_additional_income_check";--> statement-breakpoint
ALTER TABLE "liabilities" DROP CONSTRAINT "liabilities_amounts_check";--> statement-breakpoint
ALTER TABLE "liabilities" DROP CONSTRAINT "liabilities_type_check";--> statement-breakpoint
ALTER TABLE "liabilities" ALTER COLUMN "outstanding_balance" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "income_sources" ADD COLUMN "sort_order" integer;--> statement-breakpoint
WITH "ranked_income_sources" AS (
	SELECT "id", ROW_NUMBER() OVER (PARTITION BY "borrower_id" ORDER BY "created_at", "id") AS "row_number"
	FROM "income_sources"
)
UPDATE "income_sources"
SET "sort_order" = "ranked_income_sources"."row_number"
FROM "ranked_income_sources"
WHERE "income_sources"."id" = "ranked_income_sources"."id";--> statement-breakpoint
ALTER TABLE "income_sources" ALTER COLUMN "sort_order" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "income_sources" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "financial_institution_encrypted" text;--> statement-breakpoint
INSERT INTO "income_sources" (
	"borrower_id",
	"sort_order",
	"source_type",
	"monthly_amount",
	"description_encrypted",
	"created_at",
	"updated_at"
)
SELECT
	"employment_records"."borrower_id",
	1,
	"employment_records"."additional_income_type",
	"employment_records"."additional_income_amount",
	"employment_records"."additional_income_description_encrypted",
	"employment_records"."created_at",
	"employment_records"."updated_at"
FROM "employment_records"
WHERE "employment_records"."has_additional_income" = true
	AND "employment_records"."additional_income_type" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "income_sources"
		WHERE "income_sources"."borrower_id" = "employment_records"."borrower_id"
	);--> statement-breakpoint
CREATE UNIQUE INDEX "income_sources_borrower_order_uq" ON "income_sources" USING btree ("borrower_id","sort_order");--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_type_check" CHECK ("employment_records"."employment_type" in ('SALARIED', 'SELF_EMPLOYED', 'CONTROLLING_SHAREHOLDER', 'RETIRED', 'GOVERNMENT_EMPLOYEE', 'SECURITY_FORCES', 'ALLOWANCE', 'UNEMPLOYED', 'TORAH_INSTITUTION', 'OTHER'));--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_additional_type_check" CHECK ("employment_records"."additional_income_type" is null or "employment_records"."additional_income_type" in ('SALARIED', 'SECOND_BUSINESS', 'RENTAL_INCOME', 'ALLOWANCE', 'ALIMONY', 'PENSION', 'REGULAR_OVERTIME', 'REGULAR_BONUSES', 'FOREIGN_INCOME', 'INVESTMENT_INCOME', 'SMALL_SELF_EMPLOYMENT', 'FAMILY_SUPPORT', 'OTHER'));--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_additional_income_check" CHECK (("employment_records"."has_additional_income" = false and "employment_records"."additional_income_type" is null and "employment_records"."additional_income_amount" = 0) or ("employment_records"."has_additional_income" = true and "employment_records"."additional_income_type" is not null and "employment_records"."additional_income_amount" >= 0));--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_order_check" CHECK ("income_sources"."sort_order" >= 1);--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_type_check" CHECK ("income_sources"."source_type" in ('SALARIED', 'SECOND_BUSINESS', 'RENTAL_INCOME', 'ALLOWANCE', 'ALIMONY', 'PENSION', 'REGULAR_OVERTIME', 'REGULAR_BONUSES', 'FOREIGN_INCOME', 'INVESTMENT_INCOME', 'SMALL_SELF_EMPLOYMENT', 'FAMILY_SUPPORT', 'OTHER'));--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_balance_relevance_check" CHECK ("liabilities"."liability_type" not in ('RENT', 'ALIMONY') or ("liabilities"."current_balance" is null and "liabilities"."outstanding_balance" is null));--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_institution_relevance_check" CHECK ("liabilities"."liability_type" in ('LOAN', 'MORTGAGE') or "liabilities"."financial_institution_encrypted" is null);--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_amounts_check" CHECK (("liabilities"."outstanding_balance" is null or "liabilities"."outstanding_balance" >= 0) and "liabilities"."monthly_payment" >= 0 and ("liabilities"."current_balance" is null or "liabilities"."current_balance" >= 0));--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_type_check" CHECK ("liabilities"."liability_type" in ('LOAN', 'MORTGAGE', 'ALIMONY', 'RENT', 'OTHER_FINANCIAL_ENTITY'));

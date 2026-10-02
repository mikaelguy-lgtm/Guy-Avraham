ALTER TABLE "clients" ADD COLUMN "children_ages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "has_additional_income" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "additional_income_type" varchar(50);--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "additional_income_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "additional_income_description_encrypted" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "property_type_other_description_encrypted" text;--> statement-breakpoint
UPDATE "clients" SET "marital_status" = 'OTHER' WHERE "marital_status" NOT IN ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'COMMON_LAW', 'SEPARATED', 'OTHER');--> statement-breakpoint
UPDATE "employment_records" SET
  "has_additional_income" = true,
  "additional_income_type" = 'OTHER',
  "additional_income_amount" = "additional_income"
WHERE "additional_income" > 0;--> statement-breakpoint
UPDATE "employment_records" SET "employment_type" = 'OTHER' WHERE "employment_type" NOT IN ('SALARIED', 'SELF_EMPLOYED', 'CONTROLLING_SHAREHOLDER', 'RETIRED', 'GOVERNMENT_EMPLOYEE', 'SECURITY_FORCES', 'ALLOWANCE', 'UNEMPLOYED', 'OTHER');--> statement-breakpoint
UPDATE "properties" SET "property_type" = 'OTHER' WHERE "property_type" NOT IN ('APARTMENT', 'HOUSE', 'SEMI_DETACHED', 'GARDEN_APARTMENT', 'PENTHOUSE', 'LAND', 'COMMERCIAL', 'FARM', 'ESTATE', 'KIBBUTZ', 'OTHER');--> statement-breakpoint
UPDATE "loan_requests" SET "purpose" = CASE
  WHEN "purpose" = 'PURCHASE' THEN 'SECOND_HAND_PURCHASE'
  WHEN "purpose" = 'REFINANCE' THEN 'MORTGAGE_REFINANCE'
  WHEN "purpose" = 'CONSOLIDATION' THEN 'DEBT_CONSOLIDATION'
  ELSE 'ANY_PURPOSE'
END
WHERE "purpose" NOT IN ('PURCHASE_FROM_CONTRACTOR', 'BUYER_PRICE_PROGRAM', 'SECOND_HAND_PURCHASE', 'RENOVATION', 'DEBT_CONSOLIDATION', 'BUSINESS_PURPOSE', 'ANY_PURPOSE', 'SELF_CONSTRUCTION', 'FAMILY_TRANSACTION', 'KIBBUTZ_PURCHASE_OR_CONSTRUCTION', 'RECEIVER_PURCHASE', 'REVERSE_MORTGAGE', 'TAMA', 'MORTGAGE_REFINANCE');--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_marital_status_check" CHECK ("clients"."marital_status" in ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'COMMON_LAW', 'SEPARATED', 'OTHER'));--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_children_count_check" CHECK ("clients"."number_of_children" >= 0);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_borrower_count_check" CHECK ("clients"."borrower_count" >= 1);--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_type_check" CHECK ("employment_records"."employment_type" in ('SALARIED', 'SELF_EMPLOYED', 'CONTROLLING_SHAREHOLDER', 'RETIRED', 'GOVERNMENT_EMPLOYEE', 'SECURITY_FORCES', 'ALLOWANCE', 'UNEMPLOYED', 'OTHER'));--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_income_check" CHECK ("employment_records"."monthly_net_income" >= 0 and "employment_records"."additional_income_amount" >= 0);--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_additional_type_check" CHECK ("employment_records"."additional_income_type" is null or "employment_records"."additional_income_type" in ('SECOND_BUSINESS', 'RENTAL_INCOME', 'ALLOWANCE', 'ALIMONY', 'PENSION', 'REGULAR_OVERTIME', 'REGULAR_BONUSES', 'FOREIGN_INCOME', 'INVESTMENT_INCOME', 'FAMILY_SUPPORT', 'OTHER'));--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_additional_income_check" CHECK (("employment_records"."has_additional_income" = false and "employment_records"."additional_income_type" is null and "employment_records"."additional_income_amount" = 0) or ("employment_records"."has_additional_income" = true and "employment_records"."additional_income_type" is not null and "employment_records"."additional_income_amount" > 0));--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_amounts_check" CHECK ("liabilities"."outstanding_balance" >= 0 and "liabilities"."monthly_payment" >= 0);--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_purpose_check" CHECK ("loan_requests"."purpose" in ('PURCHASE_FROM_CONTRACTOR', 'BUYER_PRICE_PROGRAM', 'SECOND_HAND_PURCHASE', 'RENOVATION', 'DEBT_CONSOLIDATION', 'BUSINESS_PURPOSE', 'ANY_PURPOSE', 'SELF_CONSTRUCTION', 'FAMILY_TRANSACTION', 'KIBBUTZ_PURCHASE_OR_CONSTRUCTION', 'RECEIVER_PURCHASE', 'REVERSE_MORTGAGE', 'TAMA', 'MORTGAGE_REFINANCE'));--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_amounts_check" CHECK ("loan_requests"."requested_amount" >= 0 and "loan_requests"."requested_term_months" > 0 and "loan_requests"."loan_to_value" >= 0);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_type_check" CHECK ("properties"."property_type" in ('APARTMENT', 'HOUSE', 'SEMI_DETACHED', 'GARDEN_APARTMENT', 'PENTHOUSE', 'LAND', 'COMMERCIAL', 'FARM', 'ESTATE', 'KIBBUTZ', 'OTHER'));--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_amounts_check" CHECK ("properties"."estimated_value" >= 0 and "properties"."existing_mortgage_balance" >= 0);

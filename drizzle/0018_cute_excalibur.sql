ALTER TABLE "loan_requests" DROP CONSTRAINT "loan_requests_purpose_check";--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "housing_status" varchar(20);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "housing_status_other_encrypted" text;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD COLUMN "purpose_other_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_housing_status_check" CHECK ("borrowers"."housing_status" is null or "borrowers"."housing_status" in ('OWNED', 'RENTED', 'OTHER'));--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_housing_status_other_relevance_check" CHECK ("borrowers"."housing_status" = 'OTHER' or "borrowers"."housing_status_other_encrypted" is null);--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_purpose_other_relevance_check" CHECK ("loan_requests"."purpose" = 'OTHER' or "loan_requests"."purpose_other_encrypted" is null);--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_purpose_check" CHECK ("loan_requests"."purpose" in ('PURCHASE_FROM_CONTRACTOR', 'BUYER_PRICE_PROGRAM', 'SECOND_HAND_PURCHASE', 'RENOVATION', 'DEBT_CONSOLIDATION', 'BUSINESS_PURPOSE', 'ANY_PURPOSE', 'SELF_CONSTRUCTION', 'FAMILY_TRANSACTION', 'KIBBUTZ_PURCHASE_OR_CONSTRUCTION', 'RECEIVER_PURCHASE', 'REVERSE_MORTGAGE', 'TAMA', 'MORTGAGE_REFINANCE', 'BRIDGE_FINANCING', 'OTHER'));
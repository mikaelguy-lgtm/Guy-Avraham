CREATE TABLE "credit_indications" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"bounced_checks" boolean,
	"bounced_checks_count" integer,
	"bounced_direct_debits" boolean,
	"bounced_direct_debits_count" integer,
	"collection_proceedings" boolean,
	"bankruptcy" boolean,
	"liens" boolean,
	"mortgage_arrears" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_indications_bounced_checks_count_check" CHECK (("credit_indications"."bounced_checks" is not true and "credit_indications"."bounced_checks_count" is null) or ("credit_indications"."bounced_checks" is true and "credit_indications"."bounced_checks_count" >= 1)),
	CONSTRAINT "credit_indications_bounced_direct_debits_count_check" CHECK (("credit_indications"."bounced_direct_debits" is not true and "credit_indications"."bounced_direct_debits_count" is null) or ("credit_indications"."bounced_direct_debits" is true and "credit_indications"."bounced_direct_debits_count" >= 1))
);
--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "city_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "street_address_encrypted" text;--> statement-breakpoint
ALTER TABLE "company_submissions" ADD COLUMN "response_business_days" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_business_type_encrypted" text;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_business_start_year" integer;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_last_assessed_income" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_assessment_year" integer;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_accountant_income_previous_year" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_accountant_income_current_year" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "self_employed_accountant_months_count" integer;--> statement-breakpoint
ALTER TABLE "credit_indications" ADD CONSTRAINT "credit_indications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_indications_client_uq" ON "credit_indications" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "company_submissions" ADD CONSTRAINT "company_submissions_response_business_days_check" CHECK ("company_submissions"."response_business_days" >= 1);--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_self_employed_relevance_check" CHECK ("employment_records"."employment_type" = 'SELF_EMPLOYED' or ("employment_records"."self_employed_business_type_encrypted" is null and "employment_records"."self_employed_business_start_year" is null and "employment_records"."self_employed_last_assessed_income" is null and "employment_records"."self_employed_assessment_year" is null and "employment_records"."self_employed_accountant_income_previous_year" is null and "employment_records"."self_employed_accountant_income_current_year" is null and "employment_records"."self_employed_accountant_months_count" is null));--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_self_employed_values_check" CHECK (("employment_records"."self_employed_business_start_year" is null or "employment_records"."self_employed_business_start_year" between 1900 and 2200) and ("employment_records"."self_employed_last_assessed_income" is null or "employment_records"."self_employed_last_assessed_income" >= 0) and ("employment_records"."self_employed_assessment_year" is null or "employment_records"."self_employed_assessment_year" between 1900 and 2200) and ("employment_records"."self_employed_accountant_income_previous_year" is null or "employment_records"."self_employed_accountant_income_previous_year" >= 0) and ("employment_records"."self_employed_accountant_income_current_year" is null or "employment_records"."self_employed_accountant_income_current_year" >= 0) and ("employment_records"."self_employed_accountant_months_count" is null or "employment_records"."self_employed_accountant_months_count" between 1 and 12));
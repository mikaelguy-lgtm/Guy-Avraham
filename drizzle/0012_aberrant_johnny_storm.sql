CREATE TABLE "company_portal_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_submission_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(7, 4) NOT NULL,
	"term_months" integer NOT NULL,
	"monthly_payment" numeric(14, 2),
	"conditions" text,
	"expires_at" timestamp with time zone,
	"status" "offer_status" DEFAULT 'SUBMITTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_portal_offers_values_check" CHECK ("company_portal_offers"."amount" > 0 and "company_portal_offers"."interest_rate" >= 0 and "company_portal_offers"."interest_rate" <= 100 and "company_portal_offers"."term_months" between 12 and 600 and ("company_portal_offers"."monthly_payment" is null or "company_portal_offers"."monthly_payment" >= 0))
);
--> statement-breakpoint
ALTER TABLE "company_portal_offers" ADD CONSTRAINT "company_portal_offers_company_submission_id_company_submissions_id_fk" FOREIGN KEY ("company_submission_id") REFERENCES "public"."company_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_portal_offers" ADD CONSTRAINT "company_portal_offers_contact_id_lender_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lender_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_portal_offers_idempotency_uq" ON "company_portal_offers" USING btree ("company_submission_id","contact_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "company_portal_offers_submission_idx" ON "company_portal_offers" USING btree ("company_submission_id","created_at");
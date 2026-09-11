ALTER TABLE "clients" ADD COLUMN "marital_status" varchar(30) DEFAULT 'SINGLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "number_of_children" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "borrower_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "monthly_gross_income" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "additional_income" numeric(14, 2) DEFAULT '0' NOT NULL;
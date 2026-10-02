ALTER TABLE "case_versions" ADD COLUMN "pdf_renderer_version" integer;--> statement-breakpoint
ALTER TABLE "case_versions" ADD COLUMN "pdf_font_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "case_versions" ADD COLUMN "pdf_generated_at" timestamp with time zone;
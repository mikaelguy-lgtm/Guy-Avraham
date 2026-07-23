ALTER TABLE "borrowers" ADD COLUMN "borrower_order" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "first_name_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "last_name_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "identity_number_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "date_of_birth_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "phone_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "email_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "address_encrypted" text;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "marital_status" varchar(30);--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "number_of_children" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowers" ADD COLUMN "children_ages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "number_of_borrowers" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "borrower_relationship" varchar(30);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "borrower_relationship_other_encrypted" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "household_children_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "household_children_ages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "employment_seniority_years" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "borrower_id" integer;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
WITH ordered_borrowers AS (
  SELECT id, row_number() OVER (PARTITION BY client_id ORDER BY CASE WHEN borrower_type = 'PRIMARY' THEN 0 ELSE 1 END, id) AS position
  FROM borrowers
)
UPDATE borrowers
SET borrower_order = ordered_borrowers.position,
    is_primary = ordered_borrowers.position = 1
FROM ordered_borrowers
WHERE borrowers.id = ordered_borrowers.id;--> statement-breakpoint
UPDATE borrowers AS borrower
SET first_name_encrypted = client.first_name_encrypted,
    last_name_encrypted = client.last_name_encrypted,
    identity_number_hash = md5(borrower.identity_number_encrypted),
    phone_encrypted = client.phone_encrypted,
    email_encrypted = client.email_encrypted,
    address_encrypted = client.address_encrypted,
    marital_status = client.marital_status,
    number_of_children = CASE WHEN client.marital_status IN ('MARRIED', 'COMMON_LAW') THEN 0 ELSE client.number_of_children END,
    children_ages = CASE WHEN client.marital_status IN ('MARRIED', 'COMMON_LAW') THEN '[]'::jsonb ELSE client.children_ages END
FROM clients AS client
WHERE borrower.client_id = client.id AND borrower.is_primary = true;--> statement-breakpoint
UPDATE clients AS client
SET number_of_borrowers = borrower_totals.total,
    household_children_count = CASE WHEN client.marital_status IN ('MARRIED', 'COMMON_LAW') THEN client.number_of_children ELSE 0 END,
    household_children_ages = CASE WHEN client.marital_status IN ('MARRIED', 'COMMON_LAW') THEN client.children_ages ELSE '[]'::jsonb END
FROM (SELECT client_id, count(*)::integer AS total FROM borrowers GROUP BY client_id) AS borrower_totals
WHERE client.id = borrower_totals.client_id;--> statement-breakpoint
UPDATE employment_records
SET employment_seniority_years = greatest(0, extract(year FROM age(current_date, start_date))::integer)
WHERE start_date IS NOT NULL;--> statement-breakpoint
UPDATE liabilities AS liability
SET borrower_id = borrower.id
FROM borrowers AS borrower
WHERE liability.client_id = borrower.client_id AND borrower.is_primary = true;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowers_client_order_uq" ON "borrowers" USING btree ("client_id","borrower_order");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowers_client_identity_uq" ON "borrowers" USING btree ("client_id","identity_number_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowers_client_primary_uq" ON "borrowers" USING btree ("client_id") WHERE "borrowers"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "liabilities_borrower_idx" ON "liabilities" USING btree ("borrower_id");--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_order_check" CHECK ("borrowers"."borrower_order" >= 1);--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_children_count_check" CHECK ("borrowers"."number_of_children" >= 0);--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_marital_status_check" CHECK ("borrowers"."marital_status" is null or "borrowers"."marital_status" in ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'COMMON_LAW', 'SEPARATED', 'OTHER'));--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_number_of_borrowers_check" CHECK ("clients"."number_of_borrowers" between 1 and 5);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_borrower_relationship_check" CHECK ("clients"."borrower_relationship" is null or "clients"."borrower_relationship" in ('MARRIED', 'COMMON_LAW', 'FAMILY', 'PARTNERS', 'OTHER'));--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_household_children_count_check" CHECK ("clients"."household_children_count" >= 0);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_client_borrower_structure() RETURNS trigger AS $$
DECLARE
  target_client_id integer;
  expected_count integer;
  actual_count integer;
  primary_count integer;
BEGIN
  IF TG_TABLE_NAME = 'clients' THEN
    target_client_id := COALESCE(NEW.id, OLD.id);
  ELSE
    target_client_id := COALESCE(NEW.client_id, OLD.client_id);
  END IF;
  SELECT number_of_borrowers INTO expected_count FROM clients WHERE id = target_client_id;
  IF expected_count IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT count(*)::integer, count(*) FILTER (WHERE is_primary = true)::integer
  INTO actual_count, primary_count FROM borrowers WHERE client_id = target_client_id;
  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'CLIENT_BORROWER_COUNT_MISMATCH';
  END IF;
  IF primary_count <> 1 THEN
    RAISE EXCEPTION 'CLIENT_PRIMARY_BORROWER_MISMATCH';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER borrowers_structure_check
AFTER INSERT OR UPDATE OR DELETE ON borrowers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_client_borrower_structure();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER clients_borrower_structure_check
AFTER INSERT OR UPDATE OF number_of_borrowers ON clients
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_client_borrower_structure();

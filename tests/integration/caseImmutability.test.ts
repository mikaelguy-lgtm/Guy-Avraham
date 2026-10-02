// Real-Postgres proof (not the fake-pool store used elsewhere in this repo)
// that editing a SUBMITTED case's live client/property/loan-request fields
// never touches the immutable case_versions row or the company_submissions
// row already linked to it — the two tables a SUPER_ADMIN edit must never
// retroactively change (see the approved Release B plan, section 2/16).
import {randomBytes} from "node:crypto";
import {Pool} from "pg";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {EncryptionService} from "../../src/utils/crypto";
import {PostgresStore} from "../../src/services/store";

const pool = new Pool({connectionString: process.env.DATABASE_URL});
const encryption = new EncryptionService(Buffer.alloc(32, 4));
const store = new PostgresStore();
let clientId: number;
let caseVersionId: number;
let companySubmissionId: number;

beforeAll(async () => {
  const advisor = await pool.query("select ap.id as advisor_id, ap.user_id from advisor_profiles ap limit 1");
  if (!advisor.rows[0]) throw new Error("No seeded advisor found — run npm run db:seed first");
  const advisorId = advisor.rows[0].advisor_id;
  const advisorUserId = advisor.rows[0].user_id;
  const lender = await pool.query("select id from lenders limit 1");
  if (!lender.rows[0]) throw new Error("No seeded lender found — run npm run db:seed first");

  const enc = (value: string) => encryption.encrypt(value);
  const caseNumber = `SC-IMMUT-${randomBytes(4).toString("hex")}`;
  const tx = await pool.connect();
  try {
    await tx.query("begin");
    const client = await tx.query(
      `insert into clients(public_case_number, advisor_id, status, first_name_encrypted, last_name_encrypted, identity_number_encrypted, phone_encrypted, email_encrypted, deal_details_encrypted)
       values($1,$2,'SUBMITTED',$3,$4,$5,$6,$7,$8) returning id`,
      [caseNumber, advisorId, enc("בדיקה"), enc("אימיוטביליטי"), enc(randomBytes(5).toString("hex")), enc("0500000000"), enc("immut@test.local"), enc("בדיקת אי-שינוי")]
    );
    clientId = client.rows[0].id;
    const borrower = await tx.query(
      `insert into borrowers(client_id, borrower_type, full_name_encrypted, identity_number_encrypted, borrower_order, is_primary, first_name_encrypted, last_name_encrypted)
       values($1,'PRIMARY',$2,$3,1,true,$4,$5) returning id`,
      [clientId, enc("בדיקה אימיוטביליטי"), enc(randomBytes(5).toString("hex")), enc("בדיקה"), enc("אימיוטביליטי")]
    );
    await tx.query("insert into employment_records(borrower_id, employment_type, job_title, monthly_net_income) values($1,'SALARIED','בדיקה',20000)", [borrower.rows[0].id]);
    await tx.query("insert into properties(client_id, property_type, city, region, estimated_value) values($1,'APARTMENT','תל אביב','CENTER',2000000)", [clientId]);
    await tx.query("insert into loan_requests(client_id, purpose, requested_amount, requested_term_months, loan_to_value) values($1,'SECOND_HAND_PURCHASE',1000000,240,50)", [clientId]);
    const version = await tx.query(
      `insert into case_versions(client_id, advisor_id, created_by_user_id, version_number, status, masked_snapshot, full_snapshot_encrypted, source_client_updated_at, masked_pdf_object_key, full_pdf_object_key, redaction_report, content_hash)
       values($1,$2,$3,1,'READY','{}',$4,now(),$5,$6,'{}',$7) returning id`,
      [clientId, advisorId, advisorUserId, enc("{}"), `scratch/${caseNumber}/masked.pdf`, `scratch/${caseNumber}/full.pdf`, randomBytes(32).toString("hex")]
    );
    caseVersionId = version.rows[0].id;
    const batch = await tx.query(
      "insert into delivery_batches(client_id, advisor_id, idempotency_key, created_by_user_id) values($1,$2,$3,$4) returning id",
      [clientId, advisorId, `immut-check-${randomBytes(8).toString("hex")}`, advisorUserId]
    );
    const submission = await tx.query(
      `insert into company_submissions(public_id, case_version_id, company_id, advisor_id, batch_id, delivery_status, decision_status, access_status, response_deadline_at, response_business_days)
       values(gen_random_uuid()::text, $1, $2, $3, $4, 'SENT', 'PENDING', 'NONE', now() + interval '2 days', 2) returning id`,
      [caseVersionId, lender.rows[0].id, advisorId, batch.rows[0].id]
    );
    companySubmissionId = submission.rows[0].id;
    await tx.query("commit");
  } catch (error) {
    await tx.query("rollback");
    throw error;
  } finally {
    tx.release();
  }
});

afterAll(async () => {
  if (clientId) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await tx.query("delete from company_submissions where id=$1", [companySubmissionId]);
      await tx.query("delete from delivery_batches where client_id=$1", [clientId]);
      await tx.query("delete from case_versions where client_id=$1", [clientId]);
      await tx.query("delete from employment_records where borrower_id in (select id from borrowers where client_id=$1)", [clientId]);
      await tx.query("delete from borrowers where client_id=$1", [clientId]);
      await tx.query("delete from loan_requests where client_id=$1", [clientId]);
      await tx.query("delete from properties where client_id=$1", [clientId]);
      await tx.query("delete from clients where id=$1", [clientId]);
      await tx.query("commit");
    } catch {
      await tx.query("rollback");
    } finally {
      tx.release();
    }
  }
  await pool.end();
});

describe("SUPER_ADMIN case edit never mutates immutable case history", () => {
  it("leaves the SUBMITTED case's case_version and linked company_submission byte-for-byte unchanged after a property/loan edit", async () => {
    const before = await pool.query("select * from case_versions where id=$1", [caseVersionId]);
    const submissionBefore = await pool.query("select * from company_submissions where id=$1", [companySubmissionId]);
    const clientBefore = await pool.query("select status, updated_at from clients where id=$1", [clientId]);

    const updated = await store.updateClientProperty(clientId, {
      loanPurpose: "RENOVATION", loanPurposeOtherEncrypted: null,
      propertyType: "APARTMENT", propertyTypeOtherDescriptionEncrypted: null,
      propertyCity: "חיפה", propertyAddressEncrypted: encryption.encrypt("רחוב חדש 5"),
      propertyValue: 2_500_000, requestedAmount: 1_200_000
    });
    expect(updated).not.toBeNull();

    const after = await pool.query("select * from case_versions where id=$1", [caseVersionId]);
    const submissionAfter = await pool.query("select * from company_submissions where id=$1", [companySubmissionId]);
    const clientAfter = await pool.query("select status, updated_at from clients where id=$1", [clientId]);
    const loanAfter = await pool.query("select purpose, requested_amount from loan_requests where client_id=$1", [clientId]);

    // The immutable rows must be byte-for-byte identical — not merely
    // "close enough" — including their own updated_at, which a correct
    // implementation never touches for a case_version/company_submission
    // when only the live client/property/loan_request rows change.
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(submissionAfter.rows[0]).toEqual(submissionBefore.rows[0]);
    expect(submissionAfter.rows[0].case_version_id).toBe(caseVersionId);

    // The live case did actually change, proving this isn't a no-op test.
    expect(loanAfter.rows[0].purpose).toBe("RENOVATION");
    expect(Number(loanAfter.rows[0].requested_amount)).toBe(1_200_000);
    expect(clientAfter.rows[0].status).toBe(clientBefore.rows[0].status);
    expect(new Date(clientAfter.rows[0].updated_at).getTime()).toBeGreaterThan(new Date(clientBefore.rows[0].updated_at).getTime());
  });
});

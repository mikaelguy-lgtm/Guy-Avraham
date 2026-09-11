// Focused audit (user-requested, post-Release-B): a failure creating the
// SUPER_ADMIN notification/email must NEVER fail the business operation
// that already succeeded. This file proves all 3 core trigger points
// (advisor registration, case creation, lender-interested) are
// failure-isolated against a real Postgres backend where relevant (C),
// and against the app's real HTTP routing where relevant (A, B) — not
// against assumptions about the code.
import {randomBytes} from "node:crypto";
import request from "supertest";
import {Pool} from "pg";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createApp} from "../../src/server/app";
import {EmailService} from "../../src/services/email";
import {AdvisorEmailVerificationService} from "../../src/services/emailVerification";
import {EncryptionService} from "../../src/utils/crypto";
import {DeliveryTokenService} from "../../src/services/deliveryTokens";
import {PostgresLenderDeliveryService} from "../../src/services/lenderDelivery";
import {env, makeStore, MemoryLimiter, MemoryStorage, secrets, verifier} from "../helpers/fakes";

function app(overrides: Parameters<typeof makeStore>[0] = {}) {
  const store = makeStore(overrides);
  const email = {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn(), reload: vi.fn(), isDeliveryActive: vi.fn().mockResolvedValue(true)} as unknown as EmailService;
  return createApp({
    env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets,
    email,
    emailVerification: new AdvisorEmailVerificationService({createVerificationLink: vi.fn().mockResolvedValue({url: "http://localhost:9099/verify?oobCode=private"})}, email, store),
    passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
    gemini: {analyze: vi.fn().mockResolvedValue("analysis")} as never,
    firebaseAccounts: {deleteUser: vi.fn().mockResolvedValue(undefined), updateUserEmail: vi.fn().mockResolvedValue(undefined)}
  });
}

const registrationInput = {
  firstName: "דנה", lastName: "לוי", email: "new-advisor@example.com", phone: "0501234567",
  businessName: "דנה ייעוץ משכנתאות", acceptTerms: true
};
const registeredAdvisor = {
  id: 30, firebaseUid: "new-advisor-uid", email: "new-advisor@example.com", firstName: "דנה", lastName: "לוי",
  phoneEncrypted: new EncryptionService(Buffer.alloc(32, 4)).encrypt("+972501234567"), role: "ADVISOR" as const,
  roleLabel: "יועץ משכנתאות", status: "PENDING" as const, emailVerified: false, deletedAt: null,
  advisorId: 40, lenderId: null, businessName: "דנה ייעוץ משכנתאות",
  businessPhoneEncrypted: new EncryptionService(Buffer.alloc(32, 4)).encrypt("+972501234567"),
  businessEmail: "new-advisor@example.com", createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null
};

const completeClientInput = {
  numberOfBorrowers: 2, borrowerRelationship: "MARRIED", borrowerRelationshipOther: null,
  household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [
    {order: 1, isPrimary: true, firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15", phone: "0501234567", email: "dana@example.com", city: "תל אביב", streetAddress: "רחוב הדוגמה 1", housingStatus: "OWNED", housingStatusOther: null, maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6, selfEmployed: null}, income: {monthlyNetIncome: 20_000, additionalIncomes: [{type: "RENTAL_INCOME", monthlyAmount: 2_500, description: null}, {type: "SALARIED", monthlyAmount: 0, description: null}]}, liabilities: []},
    {order: 2, isPrimary: false, firstName: "נועם", lastName: "לוי", identityNumber: "987654321", dateOfBirth: "1987-08-20", phone: "0501234568", email: "noam@example.com", city: "תל אביב", streetAddress: "רחוב הדוגמה 1", housingStatus: "OWNED", housingStatusOther: null, maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SELF_EMPLOYED", employerName: "", jobTitle: "", employmentSeniorityYears: 0, selfEmployed: {businessType: "עסק", businessStartYear: 2018, lastAssessedIncome: 150_000, assessmentYear: 2025, accountantIncomePreviousYear: 140_000, accountantIncomeCurrentYear: 160_000, accountantMonthsCount: 12}}, income: {monthlyNetIncome: 15_000, additionalIncomes: []}, liabilities: []}
  ],
  householdLiabilities: [{type: "LOAN", otherTypeDescription: null, financialInstitution: "בנק לדוגמה", currentBalance: 120_000, monthlyPayment: 1_500, endDate: "2035-07-31", notes: "הלוואה בנקאית"}, {type: "MORTGAGE", otherTypeDescription: null, financialInstitution: "בנק למשכנתאות", currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "משכנתה קיימת"}],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס 2", value: 2_000_000},
  loanPurpose: "SECOND_HAND_PURCHASE", loanPurposeOther: null, loanRequest: {requestedAmount: 1_250_000},
  dealDetails: "תיק מלא לבדיקה"
};

describe("Admin notification/email failures never block the business operation (A, B)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined); });
  afterEach(() => { consoleError.mockRestore(); });

  it("(A) advisor registration still succeeds and sends the verification email when notifySuperAdmins throws", async () => {
    const createAdvisorAccount = vi.fn().mockResolvedValue(registeredAdvisor);
    const notifySuperAdmins = vi.fn().mockRejectedValue(new Error("simulated admin notification DB failure"));
    const response = await request(app({createAdvisorAccount, notifySuperAdmins})).post("/api/auth/register-advisor")
      .set("authorization", "Bearer new-advisor").send(registrationInput).expect(201);
    expect(response.body).toEqual({success: true, verificationEmailSent: true});
    expect(createAdvisorAccount).toHaveBeenCalledOnce();
    expect(notifySuperAdmins).toHaveBeenCalledOnce();
    // Logged, not swallowed silently — and never any PII/secret in the log.
    expect(consoleError).toHaveBeenCalledWith("Admin notification failed after a successful business operation", expect.objectContaining({errorCode: "ADMIN_NOTIFICATION_FAILED", eventType: "SUPER_ADMIN_ADVISOR_REGISTERED"}));
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/דנה|לוי|new-advisor@example\.com|0501234567/);
  });

  it("(A) advisor registration still succeeds when the email-outbox enqueue fails (settings lookup and notify both succeed)", async () => {
    const createAdvisorAccount = vi.fn().mockResolvedValue(registeredAdvisor);
    const getAdminNotificationSettings = vi.fn().mockResolvedValue({email: "admin@example.com", notifyNewAdvisor: true, notifyNewCase: true, notifyLenderInterested: true, notifyEmailFailed: false, notifyDeadlinePassed: false, notifyPrivacyRequest: false});
    const enqueueSuperAdminEmail = vi.fn().mockRejectedValue(new Error("simulated outbox insert failure"));
    const response = await request(app({createAdvisorAccount, getAdminNotificationSettings, enqueueSuperAdminEmail})).post("/api/auth/register-advisor")
      .set("authorization", "Bearer new-advisor").send(registrationInput).expect(201);
    expect(response.body).toEqual({success: true, verificationEmailSent: true});
    expect(enqueueSuperAdminEmail).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Admin notification failed after a successful business operation", expect.objectContaining({errorCode: "ADMIN_NOTIFICATION_FAILED", eventType: "SUPER_ADMIN_ADVISOR_REGISTERED"}));
  });

  it("(B) case creation still returns 201 with the real client when notifySuperAdmins throws", async () => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    const notifySuperAdmins = vi.fn().mockRejectedValue(new Error("simulated admin notification DB failure"));
    const response = await request(app({createClient, notifySuperAdmins})).post("/api/clients")
      .set("authorization", "Bearer advisor").send(completeClientInput).expect(201);
    expect(response.body).toEqual(expect.objectContaining({id: 1}));
    expect(createClient).toHaveBeenCalledOnce();
    expect(notifySuperAdmins).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Admin notification failed after a successful business operation", expect.objectContaining({errorCode: "ADMIN_NOTIFICATION_FAILED", eventType: "SUPER_ADMIN_CASE_CREATED"}));
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/דנה|לוי|123456789/);
  });

  it("(B) case creation still returns 201 when the admin-notification-settings lookup itself throws", async () => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    const getAdminNotificationSettings = vi.fn().mockRejectedValue(new Error("simulated settings read failure"));
    const response = await request(app({createClient, getAdminNotificationSettings})).post("/api/clients")
      .set("authorization", "Bearer advisor").send(completeClientInput).expect(201);
    expect(response.body).toEqual(expect.objectContaining({id: 1}));
    expect(consoleError).toHaveBeenCalledWith("Admin notification failed after a successful business operation", expect.objectContaining({errorCode: "ADMIN_NOTIFICATION_FAILED", eventType: "SUPER_ADMIN_CASE_CREATED"}));
  });
});

describe("Admin notification failure never blocks the lender-interested decision (C, real Postgres)", () => {
  const pool = new Pool({connectionString: process.env.DATABASE_URL});
  const encryption = new EncryptionService(Buffer.alloc(32, 4));
  const tokenKey = Buffer.alloc(32, 7);
  const tokens = new DeliveryTokenService(tokenKey);
  let consoleError: ReturnType<typeof vi.spyOn>;
  let clientId: number;
  let submissionId: number;
  let invitationId: number;
  let token: string;
  let code: string;

  beforeEach(async () => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const advisor = await pool.query("select ap.id as advisor_id, ap.user_id from advisor_profiles ap limit 1");
    if (!advisor.rows[0]) throw new Error("No seeded advisor found — run npm run db:seed first");
    const advisorId = advisor.rows[0].advisor_id;
    const advisorUserId = advisor.rows[0].user_id;
    const lender = await pool.query("select id from lenders limit 1");
    if (!lender.rows[0]) throw new Error("No seeded lender found — run npm run db:seed first");
    const enc = (value: string) => encryption.encrypt(value);
    const caseNumber = `SC-FAILISO-${randomBytes(4).toString("hex")}`;
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      const client = await tx.query(
        `insert into clients(public_case_number, advisor_id, status, first_name_encrypted, last_name_encrypted, identity_number_encrypted, phone_encrypted, email_encrypted, deal_details_encrypted)
         values($1,$2,'SUBMITTED',$3,$4,$5,$6,$7,$8) returning id`,
        [caseNumber, advisorId, enc("בדיקה"), enc("בידוד תקלה"), enc(randomBytes(5).toString("hex")), enc("0500000000"), enc("failiso@test.local"), enc("בדיקת בידוד תקלה")]
      );
      clientId = client.rows[0].id;
      const borrower = await tx.query(
        `insert into borrowers(client_id, borrower_type, full_name_encrypted, identity_number_encrypted, borrower_order, is_primary, first_name_encrypted, last_name_encrypted)
         values($1,'PRIMARY',$2,$3,1,true,$4,$5) returning id`,
        [clientId, enc("בדיקה בידוד תקלה"), enc(randomBytes(5).toString("hex")), enc("בדיקה"), enc("בידוד תקלה")]
      );
      await tx.query("insert into employment_records(borrower_id, employment_type, job_title, monthly_net_income) values($1,'SALARIED','בדיקה',20000)", [borrower.rows[0].id]);
      await tx.query("insert into properties(client_id, property_type, city, region, estimated_value) values($1,'APARTMENT','תל אביב','CENTER',2000000)", [clientId]);
      await tx.query("insert into loan_requests(client_id, purpose, requested_amount, requested_term_months, loan_to_value) values($1,'SECOND_HAND_PURCHASE',1000000,240,50)", [clientId]);
      const version = await tx.query(
        `insert into case_versions(client_id, advisor_id, created_by_user_id, version_number, status, masked_snapshot, full_snapshot_encrypted, source_client_updated_at, masked_pdf_object_key, full_pdf_object_key, redaction_report, content_hash)
         values($1,$2,$3,1,'READY','{}',$4,now(),$5,$6,'{}',$7) returning id`,
        [clientId, advisorId, advisorUserId, enc("{}"), `scratch/${caseNumber}/masked.pdf`, `scratch/${caseNumber}/full.pdf`, randomBytes(32).toString("hex")]
      );
      const caseVersionId = version.rows[0].id;
      const batch = await tx.query(
        "insert into delivery_batches(client_id, advisor_id, idempotency_key, created_by_user_id) values($1,$2,$3,$4) returning id",
        [clientId, advisorId, `failiso-check-${randomBytes(8).toString("hex")}`, advisorUserId]
      );
      const submission = await tx.query(
        `insert into company_submissions(public_id, case_version_id, company_id, advisor_id, batch_id, delivery_status, decision_status, access_status, response_deadline_at, response_business_days)
         values(gen_random_uuid()::text, $1, $2, $3, $4, 'SENT', 'PENDING', 'NONE', now() + interval '2 days', 2) returning id`,
        [caseVersionId, lender.rows[0].id, advisorId, batch.rows[0].id]
      );
      submissionId = submission.rows[0].id;
      const contact = await tx.query(
        `insert into lender_contacts(lender_id, first_name, last_name, role_title, email, email_normalized, is_primary, active)
         values($1,'איש','קשר','חתם','contact@lender.test','contact@lender.test',true,true) returning id`,
        [lender.rows[0].id]
      );
      const contactId = contact.rows[0].id;
      const tokenNonce = tokens.createNonce();
      const invitationPublicId = randomBytes(8).toString("hex");
      token = tokens.deriveToken("review", invitationPublicId, tokenNonce);
      const invitation = await tx.query(
        `insert into submission_contact_invitations(public_id, company_submission_id, contact_id, token_hash, token_nonce, token_expires_at, status)
         values($1,$2,$3,$4,$5, now() + interval '2 days', 'SENT') returning id`,
        [invitationPublicId, submissionId, contactId, tokens.hash(token), tokenNonce]
      );
      invitationId = invitation.rows[0].id;
      const codeNonce = tokens.createNonce();
      code = tokens.deriveOtp("INTEREST_DECISION", `${submissionId}:${contactId}`, codeNonce);
      await tx.query(
        `insert into otp_challenges(purpose, company_submission_id, contact_id, invitation_id, code_hash, code_nonce, expires_at, attempts, max_attempts, last_sent_at)
         values('INTEREST_DECISION',$1,$2,$3,$4,$5, now() + interval '10 minutes', 0, 5, now())`,
        [submissionId, contactId, invitationId, tokens.hash(code), codeNonce]
      );
      await tx.query("commit");
    } catch (error) {
      await tx.query("rollback");
      throw error;
    } finally {
      tx.release();
    }
  });

  afterEach(async () => {
    consoleError.mockRestore();
    if (clientId) {
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        // decision_contact_id must be cleared before lender_contacts can be
        // deleted; verifyInterest's real success path also creates access
        // grants/portal sessions/an email_outbox row that a naive cleanup
        // (deleting lender_contacts too early) would silently fail to
        // remove — every dependent table is covered here, in FK order.
        await tx.query("update company_submissions set decision_contact_id=null where id=$1", [submissionId]);
        await tx.query("delete from external_portal_sessions where access_grant_id in (select id from company_portal_access_grants where company_submission_id=$1)", [submissionId]);
        await tx.query("delete from company_portal_access_grants where company_submission_id=$1", [submissionId]);
        await tx.query("delete from submission_events where company_submission_id=$1", [submissionId]);
        await tx.query("delete from otp_challenges where company_submission_id=$1", [submissionId]);
        await tx.query("delete from email_outbox where company_submission_id=$1", [submissionId]);
        await tx.query("delete from submission_contact_invitations where company_submission_id=$1", [submissionId]);
        await tx.query("delete from company_submissions where id=$1", [submissionId]);
        await tx.query("delete from lender_contacts where email='contact@lender.test'");
        await tx.query("delete from delivery_batches where client_id=$1", [clientId]);
        await tx.query("delete from case_versions where client_id=$1", [clientId]);
        await tx.query("delete from employment_records where borrower_id in (select id from borrowers where client_id=$1)", [clientId]);
        await tx.query("delete from borrowers where client_id=$1", [clientId]);
        await tx.query("delete from loan_requests where client_id=$1", [clientId]);
        await tx.query("delete from properties where client_id=$1", [clientId]);
        await tx.query("delete from clients where id=$1", [clientId]);
        await tx.query("commit");
      } catch (error) {
        await tx.query("rollback");
        // Never swallow a cleanup failure silently — an orphaned scratch
        // row here would otherwise surface as a confusing unique-constraint
        // failure in a later, unrelated test run.
        console.error("Test cleanup failed — scratch rows may remain, manual cleanup needed", error);
      } finally {
        tx.release();
      }
    }
  });

  it("(C) the INTERESTED decision commits and the call still succeeds even when the post-commit admin notification query fails", async () => {
    // Only the notification helper's own query fails — every other query
    // (the entire verifyInterest transaction) hits the real pool untouched,
    // so this proves the actual business logic, not a mock of it.
    const realQuery = pool.query.bind(pool);
    const failingPool = {
      connect: () => pool.connect(),
      query: (sql: string, params?: unknown[]) => {
        if (typeof sql === "string" && sql.includes("select u.first_name from advisor_profiles")) {
          throw new Error("simulated admin notification lookup failure");
        }
        return realQuery(sql as never, params as never);
      }
    };
    const service = new PostgresLenderDeliveryService({
      pool: failingPool as never, storage: {} as never, email: {send: async () => ({messageId: "x"})} as never,
      encryption, tokens: tokens as never, broker: {publish: () => undefined} as never,
      appUrl: "http://localhost", nodeEnv: "test", processJobsOnDemand: false, now: () => new Date()
    });

    const result = await service.verifyInterest(token, code, {requestId: "test-failure-isolation"});

    expect(result.decisionStatus).toBe("INTERESTED");
    expect(result.accessStatus).toBe("ACTIVE");
    expect(result.sessionToken).toEqual(expect.any(String));

    const submission = await pool.query("select decision_status from company_submissions where id=$1", [submissionId]);
    expect(submission.rows[0].decision_status).toBe("INTERESTED");

    // Logged, not swallowed — and no PII (no name/email/case number) in the log.
    expect(consoleError).toHaveBeenCalledWith("Admin notification failed after a successful INTERESTED decision", expect.objectContaining({errorCode: "ADMIN_NOTIFICATION_FAILED", eventType: "SUPER_ADMIN_LENDER_INTERESTED", submissionId, requestId: "test-failure-isolation"}));
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/contact@lender\.test|בדיקה|קשר/);

    // No duplicate notification/email row exists for this submission either
    // (the failure happened before either insert, so there is nothing to
    // have duplicated — confirms no retry loop was triggered).
    const notifications = await pool.query("select count(*) from notifications where idempotency_key like $1", [`%LENDER_INTERESTED:${submissionId}:%`]);
    expect(Number(notifications.rows[0].count)).toBe(0);
  });
});

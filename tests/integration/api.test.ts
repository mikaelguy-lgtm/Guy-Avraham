import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { EmailService, resolveSmtpTransportSettings, SmtpServiceError } from "../../src/services/email";
import { AdvisorEmailVerificationService, type EmailVerificationService } from "../../src/services/emailVerification";
import { EncryptionService } from "../../src/utils/crypto";
import { InMemorySecretProvider, type SecretProvider } from "../../src/utils/secretManager";
import { env, makeStore, MemoryLimiter, MemoryStorage, secrets, users, verifier } from "../helpers/fakes";
import type { EmailConfigurationRecord } from "../../src/services/store";

type TestEmailService = {
  verify: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  test: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  isDeliveryActive: ReturnType<typeof vi.fn>;
};

function app(overrides: Parameters<typeof makeStore>[0] = {}, emailService?: Partial<TestEmailService> | EmailService, secretProvider: SecretProvider = secrets, environment = env, verificationService?: EmailVerificationService, firebaseAccounts?: {deleteUser(uid: string): Promise<void>; updateUserEmail(uid: string, newEmail: string): Promise<void>}) {
  const store = makeStore(overrides);
  const defaultEmail = {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn().mockResolvedValue({messageId: "message-1"}), reload: vi.fn(), isDeliveryActive: vi.fn().mockResolvedValue(environment.EMAIL_DELIVERY_ENABLED)};
  const email = emailService instanceof EmailService ? emailService : {...defaultEmail, ...(emailService ?? {})} as unknown as EmailService;
  return createApp({
    env: environment, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets: secretProvider,
    email,
    emailVerification: verificationService ?? new AdvisorEmailVerificationService({createVerificationLink: vi.fn().mockResolvedValue({url: "http://localhost:9099/verify?oobCode=private"})}, email, store),
    passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
    gemini: {analyze: vi.fn().mockResolvedValue("analysis")} as never,
    firebaseAccounts: firebaseAccounts ?? {deleteUser: vi.fn().mockResolvedValue(undefined), updateUserEmail: vi.fn().mockResolvedValue(undefined)}
  });
}

const smtpSettings = {
  provider: "CUSTOM",
  host: "mailpit",
  port: 1025,
  securityMode: "NONE",
  username: null,
  fromEmail: "no-reply@syncash.local",
  fromName: "SynCash",
  replyTo: "support@syncash.local"
};

function emailConfiguration(overrides: Partial<EmailConfigurationRecord> = {}): EmailConfigurationRecord {
  return {
    id: 1, provider: "CUSTOM", status: "DRAFT", host: "mailpit", port: 1025, securityMode: "NONE", username: null,
    fromEmail: "no-reply@syncash.local", fromName: "SynCash", replyTo: "support@syncash.local",
    secretName: "syncash-smtp-password", secretVersion: "latest", previousConfigurationId: null,
    lastTestedAt: null, lastTestFailureCode: null, activatedAt: null, supersededAt: null,
    createdByUserId: users.super.id, updatedByUserId: users.super.id, createdAt: new Date(), updatedAt: new Date(), ...overrides
  };
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

const legacyCompleteClientInput = {
  firstName: "דנה", lastName: "לוי", identityNumber: "123456789", birthDate: "1985-06-15",
  phone: "0501234567", email: "dana@example.com", address: "רחוב הדוגמה 1, תל אביב",
  maritalStatus: "MARRIED", numberOfChildren: 2, childrenAges: [4, 8], borrowerCount: 2,
  employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6,
  monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME",
  additionalIncomeAmount: 2_500, additionalIncomeDescription: null, monthlyLiabilities: 1_500,
  existingMortgageBalance: 400_000, existingMortgageMonthlyPayment: 4_000,
  dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyTypeOtherDescription: null,
  propertyCity: "תל אביב", propertyRegion: "CENTER", propertyAddress: "רחוב הנכס 2, תל אביב",
  propertyValue: 2_000_000, requestedAmount: 1_250_000, requestedTermMonths: 240,
  notes: "תיק מלא לבדיקה", status: "ACTIVE"
};

void legacyCompleteClientInput;
const completeClientInput = {
  numberOfBorrowers: 2, borrowerRelationship: "MARRIED", borrowerRelationshipOther: null,
  household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [
    {order: 1, isPrimary: true, firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15", phone: "0501234567", email: "dana@example.com", city: "תל אביב", streetAddress: "רחוב הדוגמה 1", maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6, selfEmployed: null}, income: {monthlyNetIncome: 20_000, additionalIncomes: [{type: "RENTAL_INCOME", monthlyAmount: 2_500, description: null}, {type: "SALARIED", monthlyAmount: 0, description: null}]}, liabilities: []},
    {order: 2, isPrimary: false, firstName: "נועם", lastName: "לוי", identityNumber: "987654321", dateOfBirth: "1987-08-20", phone: "0501234568", email: "noam@example.com", city: "תל אביב", streetAddress: "רחוב הדוגמה 1", maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SELF_EMPLOYED", employerName: "", jobTitle: "", employmentSeniorityYears: 0, selfEmployed: {businessType: "עסק", businessStartYear: 2018, lastAssessedIncome: 150_000, assessmentYear: 2025, accountantIncomePreviousYear: 140_000, accountantIncomeCurrentYear: 160_000, accountantMonthsCount: 12}}, income: {monthlyNetIncome: 15_000, additionalIncomes: []}, liabilities: []}
  ],
  householdLiabilities: [{type: "LOAN", otherTypeDescription: null, financialInstitution: "בנק לדוגמה", currentBalance: 120_000, monthlyPayment: 1_500, endDate: "2035-07-31", notes: "הלוואה בנקאית"}, {type: "MORTGAGE", otherTypeDescription: null, financialInstitution: "בנק למשכנתאות", currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "משכנתה קיימת"}],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס 2", value: 2_000_000},
  loanPurpose: "SECOND_HAND_PURCHASE", loanRequest: {requestedAmount: 1_250_000},
  dealDetails: "תיק מלא לבדיקה", status: "ACTIVE"
};

describe("HTTP authentication and authorization", () => {
  it("returns 401 without a token", async () => { await request(app()).get("/api/auth/me").expect(401); });
  it("returns 401 for an invalid token", async () => { await request(app()).get("/api/auth/me").set("authorization", "Bearer invalid").expect(401); });
  it("returns 403 for a suspended user", async () => { await request(app()).get("/api/auth/me").set("authorization", "Bearer suspended").expect(403); });
  it("blocks an advisor from another advisor's client", async () => { await request(app()).get("/api/clients/2").set("authorization", "Bearer advisor").expect(403); });
  it("returns localized UI data from persisted client relations without ciphertext", async () => {
    const response = await request(app()).get("/api/clients/1").set("authorization", "Bearer advisor").expect(200);
    expect(response.body).toEqual(expect.objectContaining({firstName: "Dana", requestedAmount: 1_000_000, propertyValue: 2_000_000, employmentType: "SALARIED"}));
    expect(JSON.stringify(response.body)).not.toContain("encrypted");
  });
  it("protects the advisor submission-status endpoint", async () => {
    await request(app()).get("/api/clients/1/submissions").set("authorization", "Bearer advisor").expect(200, []);
    await request(app()).get("/api/clients/1/submissions").set("authorization", "Bearer advisor2").expect(403);
  });
  it.each(["admin", "advisor", "lender"])("blocks %s from all SMTP administration endpoints", async (token) => {
    await request(app()).patch("/api/admin/settings/email").set("authorization", `Bearer ${token}`).send(smtpSettings).expect(403);
    await request(app()).patch("/api/admin/settings/email").set("authorization", `Bearer ${token}`).send({...smtpSettings, smtpPassword: "not-used"}).expect(403);
    await request(app()).post("/api/admin/settings/email/1/test").set("authorization", `Bearer ${token}`).send({recipientEmail: "blocked@example.test"}).expect(403);
    await request(app()).post("/api/admin/settings/email/1/activate").set("authorization", `Bearer ${token}`).expect(403);
    await request(app()).post("/api/admin/settings/email/rollback").set("authorization", `Bearer ${token}`).expect(403);
  });

  it("shows masked email logs to admins without exposing recipients", async () => {
    const listRecentEmailLogs = vi.fn().mockResolvedValue([{recipient: "advisor@example.com", template: "ADVISOR_EMAIL_VERIFICATION", status: "SENT", sanitizedError: null, requestId: "request-safe", sentAt: new Date("2026-07-15T12:30:00.000Z"), failedAt: null, createdAt: new Date("2026-07-15T12:30:00.000Z"), attempts: 1, resent: false}]);
    const response = await request(app({listRecentEmailLogs})).get("/api/admin/email-logs").set("authorization", "Bearer admin").expect(200);
    expect(response.body[0]).toEqual(expect.objectContaining({recipientMasked: "ad*****@e******.com", status: "SENT", requestId: "request-safe"}));
    expect(JSON.stringify(response.body)).not.toContain("advisor@example.com");
    await request(app({listRecentEmailLogs})).get("/api/admin/email-logs").set("authorization", "Bearer advisor").expect(403);
  });

  it("allows SUPER_ADMIN to create an SMTP draft and password version without returning the password", async () => {
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const localSecrets = new InMemorySecretProvider();
    const response = await request(app({addAudit}, undefined, localSecrets)).patch("/api/admin/settings/email")
      .set("authorization", "Bearer super").send({...smtpSettings, smtpPassword: "local-test-password"}).expect(200);
    expect(response.body.draft).toEqual(expect.objectContaining({status: "DRAFT", passwordConfigured: true}));
    expect(JSON.stringify(response.body)).not.toContain("local-test-password");
    expect(await localSecrets.getSecret("syncash-smtp-password")).toBe("local-test-password");
    expect(JSON.stringify(addAudit.mock.calls)).not.toContain("local-test-password");
  });

  it("normalizes grouped Gmail App Password spaces before creating the secret version", async () => {
    const setSecret = vi.fn().mockResolvedValue("projects/syncash-production/secrets/syncash-smtp-password/versions/7");
    const secretProvider: SecretProvider = {getSecret: vi.fn(), isConfigured: vi.fn(), setSecret};
    const response = await request(app({}, undefined, secretProvider)).patch("/api/admin/settings/email")
      .set("authorization", "Bearer super").send({
        ...smtpSettings,
        provider: "GMAIL",
        host: "smtp.gmail.com",
        port: 587,
        securityMode: "STARTTLS",
        username: "advisor@gmail.com",
        fromEmail: "advisor@gmail.com",
        smtpPassword: "abcd efgh ijkl mnop"
      }).expect(200);
    expect(response.body.draft).toEqual(expect.objectContaining({provider: "GMAIL", passwordConfigured: true}));
    expect(setSecret).toHaveBeenCalledWith("syncash-smtp-password", "abcdefghijklmnop");
    expect(JSON.stringify(response.body)).not.toContain("abcdefghijklmnop");
  });

  it("rejects an invalid Gmail App Password format before writing a secret", async () => {
    const setSecret = vi.fn();
    const secretProvider: SecretProvider = {getSecret: vi.fn(), isConfigured: vi.fn(), setSecret};
    const response = await request(app({}, undefined, secretProvider)).patch("/api/admin/settings/email")
      .set("authorization", "Bearer super").send({
        ...smtpSettings,
        provider: "GMAIL",
        host: "smtp.gmail.com",
        port: 587,
        securityMode: "STARTTLS",
        username: "advisor@gmail.com",
        fromEmail: "advisor@gmail.com",
        smtpPassword: "too short"
      }).expect(422);
    expect(response.body).toEqual(expect.objectContaining({error: "GMAIL_APP_PASSWORD_INVALID", requestId: expect.any(String)}));
    expect(setSecret).not.toHaveBeenCalled();
  });

  it("allows only SUPER_ADMIN when production access is restricted", async () => {
    const restrictedEnv = {...env, EMAIL_DELIVERY_ENABLED: false, PUBLIC_REGISTRATION_ENABLED: false, EXTERNAL_PORTALS_ENABLED: false, SUPER_ADMIN_ONLY_MODE: true};
    await request(app({}, undefined, secrets, restrictedEnv)).get("/api/auth/me").set("authorization", "Bearer super").expect(200);
    for (const token of ["admin", "advisor", "lender"]) {
      const response = await request(app({}, undefined, secrets, restrictedEnv)).get("/api/auth/me").set("authorization", `Bearer ${token}`).expect(403);
      expect(response.body).toEqual(expect.objectContaining({error: "PRODUCTION_ACCESS_RESTRICTED", requestId: expect.any(String)}));
    }
  });

  it("blocks public account creation and verification flows when registration is disabled", async () => {
    const createAdvisorAccount = vi.fn();
    const restrictedEnv = {...env, EMAIL_DELIVERY_ENABLED: false, PUBLIC_REGISTRATION_ENABLED: false, EXTERNAL_PORTALS_ENABLED: false, SUPER_ADMIN_ONLY_MODE: true};
    const registration = await request(app({createAdvisorAccount}, undefined, secrets, restrictedEnv)).post("/api/auth/register-advisor")
      .set("authorization", "Bearer new-advisor").send(registrationInput).expect(503);
    const resend = await request(app({}, undefined, secrets, restrictedEnv)).post("/api/auth/email-verification/resend")
      .set("authorization", "Bearer pending").expect(503);
    const status = await request(app({}, undefined, secrets, restrictedEnv)).get("/api/auth/email-verification/status")
      .set("authorization", "Bearer pending").expect(503);
    for (const response of [registration, resend, status]) {
      expect(response.body).toEqual(expect.objectContaining({error: "PUBLIC_REGISTRATION_DISABLED", requestId: expect.any(String)}));
    }
    expect(createAdvisorAccount).not.toHaveBeenCalled();
  });
});

describe("advisor self-registration", () => {
  it("creates a pending advisor, sends verification and records the message id", async () => {
    const createAdvisorAccount = vi.fn().mockResolvedValue(registeredAdvisor);
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockResolvedValue({messageId: "verification-message-1"});
    const response = await request(app({createAdvisorAccount, addEmailLog}, {send})).post("/api/auth/register-advisor")
      .set("authorization", "Bearer new-advisor").send({...registrationInput, role: undefined}).expect(201);
    expect(response.body).toEqual({success: true, verificationEmailSent: true});
    expect(createAdvisorAccount).toHaveBeenCalledWith(expect.objectContaining({firebaseUid: "new-advisor-uid", email: "new-advisor@example.com"}));
    expect(createAdvisorAccount.mock.calls[0][0]).not.toHaveProperty("password");
    expect(createAdvisorAccount.mock.calls[0][0]).not.toHaveProperty("role");
    expect(createAdvisorAccount.mock.calls[0][0]).not.toHaveProperty("status");
    expect(send).toHaveBeenCalledWith("new-advisor@example.com", "אימות כתובת הדוא״ל שלך – SynCash", expect.stringContaining("dir=\"rtl\""), expect.objectContaining({verifyTransport: true, text: expect.stringContaining("תודה שנרשמת")}));
    expect(addEmailLog).toHaveBeenCalledWith(expect.objectContaining({recipient: "new-advisor@example.com", template: "ADVISOR_EMAIL_VERIFICATION", userId: 30, messageId: "verification-message-1", status: "SENT", requestId: expect.any(String)}));
    expect(JSON.stringify(response.body)).not.toMatch(/password|firebase|oobCode|verify\?/i);
  });

  it("keeps the advisor pending and never reports email success when SMTP fails", async () => {
    const createAdvisorAccount = vi.fn().mockResolvedValue(registeredAdvisor);
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("private smtp detail"), {code: "EAUTH", responseCode: 535}));
    const response = await request(app({createAdvisorAccount, addEmailLog, addAudit}, {send})).post("/api/auth/register-advisor")
      .set("authorization", "Bearer new-advisor").send(registrationInput).expect(502);
    expect(response.body).toEqual(expect.objectContaining({accountCreated: true, verificationEmailSent: false, requestId: expect.any(String)}));
    expect(response.body).not.toHaveProperty("messageId");
    expect(JSON.stringify(response.body)).not.toMatch(/private smtp detail|oobCode|password/i);
    expect(createAdvisorAccount).toHaveBeenCalledOnce();
    expect(registeredAdvisor.status).toBe("PENDING");
    expect(addEmailLog).toHaveBeenCalledWith(expect.objectContaining({template: "ADVISOR_EMAIL_VERIFICATION", userId: 30, status: "FAILED", sanitizedError: "SMTP_AUTH_FAILED"}));
    expect(addAudit).toHaveBeenCalledWith(30, "ADVISOR_VERIFICATION_EMAIL_FAILED", "user", 30, expect.objectContaining({errorCode: "SMTP_AUTH_FAILED"}), expect.any(String), expect.any(String), undefined);
  });

  it("resend creates a fresh link and does not expose either link", async () => {
    const createVerificationLink = vi.fn()
      .mockResolvedValueOnce({url: "http://localhost:9099/verify?oobCode=first-private"})
      .mockResolvedValueOnce({url: "http://localhost:9099/verify?oobCode=second-private"});
    const send = vi.fn().mockResolvedValueOnce({messageId: "first-message"}).mockResolvedValueOnce({messageId: "second-message"});
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const store = makeStore({createAdvisorAccount: async () => registeredAdvisor, addEmailLog});
    const email = {send, isDeliveryActive: vi.fn().mockResolvedValue(true)} as unknown as EmailService;
    const verification = new AdvisorEmailVerificationService({createVerificationLink}, email, store);
    const application = createApp({
      env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)), storage: new MemoryStorage(),
      limiter: new MemoryLimiter(), secrets, email, emailVerification: verification,
      passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
      gemini: {analyze: vi.fn()} as never, firebaseAccounts: {deleteUser: vi.fn(), updateUserEmail: vi.fn()}
    });
    const registration = await request(application).post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor").send(registrationInput).expect(201);
    const resend = await request(application).post("/api/auth/email-verification/resend").set("authorization", "Bearer pending").expect(200);
    expect(createVerificationLink).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][2]).toContain("first-private");
    expect(send.mock.calls[1][2]).toContain("second-private");
    expect(JSON.stringify([registration.body, resend.body, addEmailLog.mock.calls])).not.toContain("oobCode");
    expect(resend.body).toEqual(expect.objectContaining({success: true, verificationEmailSent: true, lastSentAt: expect.any(String)}));
  });

  it("delivers the verification template to Mailpit and stores its sanitized message id", async () => {
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const localEnv = {...env, SMTP_HOST: "127.0.0.1", SMTP_PORT: 1025, SMTP_SECURE: false, SMTP_USER: ""};
    const email = new EmailService(localEnv, new InMemorySecretProvider(), async () => ({SMTP_HOST: "127.0.0.1", SMTP_PORT: "1025", SMTP_SECURITY_MODE: "NONE", SMTP_USER: null, EMAIL_FROM: "no-reply@syncash.local", EMAIL_FROM_NAME: "SynCash", EMAIL_REPLY_TO: "support@syncash.local"}));
    const response = await request(app({createAdvisorAccount: async () => registeredAdvisor, addEmailLog}, email, new InMemorySecretProvider(), localEnv))
      .post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor").send(registrationInput).expect(201);
    expect(response.body).toEqual({success: true, verificationEmailSent: true});
    const messageId = addEmailLog.mock.calls[0][0].messageId as string;
    expect(messageId).toEqual(expect.any(String));
    await expect.poll(async () => {
      const listing = await fetch("http://localhost:8025/api/v1/messages").then((result) => result.json()) as {messages?: Array<{MessageID?: string; Subject?: string; To?: Array<{Address?: string}>}>};
      return listing.messages?.some((message) => message.MessageID === messageId || (message.Subject === "אימות כתובת הדוא״ל שלך – SynCash" && message.To?.some((target) => target.Address === registeredAdvisor.email))) ?? false;
    }).toBe(true);
  });

  it.each([
    [{...registrationInput, businessName: ""}, "missing business name"],
    [{...registrationInput, phone: ""}, "missing phone"],
    [{...registrationInput, email: "invalid"}, "invalid email"]
  ])("rejects %s", async (body) => {
    await request(app()).post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor").send(body).expect(400);
  });

  it("blocks duplicate email and Firebase UID", async () => {
    await request(app({findUserByEmail: async () => users.advisor})).post("/api/auth/register-advisor").set("authorization", "Bearer duplicate-email")
      .send({...registrationInput, email: "registered@example.com"}).expect(409);
    await request(app()).post("/api/auth/register-advisor").set("authorization", "Bearer duplicate-uid")
      .send({...registrationInput, email: "fresh@example.com"}).expect(409);
  });

  it("rejects role and status supplied by the browser", async () => {
    await request(app()).post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor")
      .send({...registrationInput, role: "SUPER_ADMIN"}).expect(400);
    await request(app()).post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor")
      .send({...registrationInput, status: "ACTIVE"}).expect(400);
  });

  it("blocks an unverified advisor and activates after a verified Firebase token", async () => {
    await request(app()).get("/api/auth/me").set("authorization", "Bearer pending").expect(403);
    const activateVerifiedAdvisor = vi.fn().mockResolvedValue({...registeredAdvisor, id: 8, firebaseUid: "pending", email: "pending@test", status: "ACTIVE", emailVerified: true});
    const response = await request(app({activateVerifiedAdvisor})).get("/api/auth/me").set("authorization", "Bearer pending-verified").expect(200);
    expect(activateVerifiedAdvisor).toHaveBeenCalledWith(8);
    expect(response.body.status).toBe("ACTIVE");
    expect(response.body.emailVerified).toBe(true);
  });

  it("rate limits registration and verification resend", async () => {
    const registrationApp = app({createAdvisorAccount: async () => registeredAdvisor});
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(registrationApp).post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor").send(registrationInput).expect(201);
    }
    await request(registrationApp).post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor").send(registrationInput).expect(429);

    const resendApp = app();
    await request(resendApp).post("/api/auth/email-verification/resend").set("authorization", "Bearer pending").expect(200);
    await request(resendApp).post("/api/auth/email-verification/resend").set("authorization", "Bearer pending").expect(429);
  });
});

describe("SMTP administration", () => {
  it("persists non-secret settings without replacing an existing SMTP password", async () => {
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const active = emailConfiguration({status: "ACTIVE", activatedAt: new Date()});
    const createEmailConfiguration = vi.fn().mockImplementation(async (values) => emailConfiguration({id: 2, ...values, status: "DRAFT"}));
    const localSecrets = new InMemorySecretProvider({"syncash-smtp-password": "existing-secret"});
    const setSecret = vi.spyOn(localSecrets, "setSecret");
    const response = await request(app({getActiveEmailConfiguration: async () => active, createEmailConfiguration, addAudit}, undefined, localSecrets)).patch("/api/admin/settings/email")
      .set("authorization", "Bearer super").send({...smtpSettings, baseConfigurationId: active.id}).expect(200);
    expect(response.body.draft).toEqual(expect.objectContaining({status: "DRAFT", passwordConfigured: true}));
    expect(setSecret).not.toHaveBeenCalled();
    expect(await localSecrets.getSecret("syncash-smtp-password")).toBe("existing-secret");
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "SMTP_DRAFT_CREATED", "email_configuration", 2, expect.objectContaining({passwordUpdated: false}), expect.any(String));
  });

  it.each([
    ["Gmail", "smtp.gmail.com"],
    ["Brevo", "smtp-relay.brevo.com"]
  ])("uses %s with port 587 and STARTTLS", (_provider, host) => {
    const resolved = resolveSmtpTransportSettings(env, {SMTP_HOST: host, SMTP_PORT: "587", SMTP_SECURITY_MODE: "STARTTLS", SMTP_USER: "smtp-user"}, "not-a-real-password");
    expect(resolved).toEqual(expect.objectContaining({host, port: 587, secure: false, requireTLS: true, ignoreTLS: false}));
  });

  it("supports custom direct TLS without applying STARTTLS", () => {
    const resolved = resolveSmtpTransportSettings(env, {SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_SECURITY_MODE: "TLS", SMTP_USER: "smtp-user"}, "not-a-real-password");
    expect(resolved).toEqual(expect.objectContaining({port: 465, secure: true, requireTLS: false, ignoreTLS: false}));
  });

  it("returns a clear failure when the SMTP password is missing", async () => {
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const configuration = emailConfiguration({secretName: null, secretVersion: null});
    const email = {test: vi.fn().mockRejectedValue(new SmtpServiceError("SMTP_PASSWORD_NOT_CONFIGURED")), reload: vi.fn(), isDeliveryActive: vi.fn()};
    const response = await request(app({getEmailConfiguration: async () => configuration, markEmailConfigurationTest: async () => configuration, addEmailLog}, email)).post("/api/admin/settings/email/1/test")
      .set("authorization", "Bearer super").send({recipientEmail: "super@example.test"}).expect(409);
    expect(response.body).toEqual(expect.objectContaining({error: "SMTP_CREDENTIAL_NOT_CONFIGURED", requestId: expect.any(String)}));
    expect(addEmailLog).toHaveBeenCalledWith(expect.objectContaining({recipient: "super@example.test", template: "SMTP_CONFIGURATION_TEST", status: "FAILED", sanitizedError: "SMTP_CREDENTIAL_NOT_CONFIGURED"}));
  });

  it("sanitizes invalid Gmail credentials and never reports success", async () => {
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const configuration = emailConfiguration({provider: "GMAIL", host: "smtp.gmail.com", port: 587, securityMode: "STARTTLS", username: "user@gmail.com"});
    const email = {test: vi.fn().mockRejectedValue(Object.assign(new Error("535 password=private"), {code: "EAUTH", responseCode: 535})), reload: vi.fn(), isDeliveryActive: vi.fn()};
    const response = await request(app({getEmailConfiguration: async () => configuration, markEmailConfigurationTest: async () => configuration, addEmailLog}, email)).post("/api/admin/settings/email/1/test")
      .set("authorization", "Bearer super").send({recipientEmail: "super@example.test"}).expect(502);
    expect(response.body).toEqual(expect.objectContaining({error: "SMTP_AUTH_FAILED", requestId: expect.any(String)}));
    expect(response.body).not.toHaveProperty("messageId");
    expect(JSON.stringify(response.body)).not.toContain("private");
  });

  it("sends through Mailpit and records a successful email log", async () => {
    const recipient = `smtp-test-${Date.now()}@syncash.local`;
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const localEnv = {...env, SMTP_HOST: "127.0.0.1", SMTP_PORT: 1025, SMTP_SECURE: false, SMTP_USER: ""};
    const configuration = emailConfiguration({host: "127.0.0.1", secretName: null, secretVersion: null});
    const tested = emailConfiguration({...configuration, status: "TESTED", lastTestedAt: new Date()});
    const email = new EmailService(localEnv, new InMemorySecretProvider());
    const response = await request(app({getEmailConfiguration: async () => configuration, markEmailConfigurationTest: async () => tested, addEmailLog}, email, new InMemorySecretProvider(), localEnv)).post("/api/admin/settings/email/1/test")
      .set("authorization", "Bearer super").send({recipientEmail: recipient}).expect(200);
    expect(response.body.messageId).toEqual(expect.any(String));
    expect(response.body.draft.status).toBe("TESTED");
    expect(addEmailLog).toHaveBeenCalledWith(expect.objectContaining({recipient, template: "SMTP_CONFIGURATION_TEST", messageId: response.body.messageId, status: "SENT"}));
    await expect.poll(async () => {
      const listing = await fetch("http://localhost:8025/api/v1/messages").then((result) => result.json()) as {messages?: Array<{To?: Array<{Address?: string}>}>};
      return listing.messages?.some((message) => message.To?.some((target) => target.Address === recipient)) ?? false;
    }).toBe(true);
  });

  it("activates only a tested draft and supports rollback", async () => {
    const tested = emailConfiguration({id: 2, status: "TESTED", lastTestedAt: new Date()});
    const activated = emailConfiguration({id: 2, status: "ACTIVE", activatedAt: new Date(), previousConfigurationId: 1});
    const previous = emailConfiguration({id: 1, status: "ACTIVE", activatedAt: new Date()});
    const addAudit = vi.fn();
    const email = {reload: vi.fn(), test: vi.fn(), isDeliveryActive: vi.fn(), send: vi.fn(), verify: vi.fn()};
    const activate = await request(app({getEmailConfiguration: async () => tested, activateEmailConfiguration: async () => activated, addAudit}, email)).post("/api/admin/settings/email/2/activate").set("authorization", "Bearer super").expect(200);
    expect(activate.body.active.status).toBe("ACTIVE");
    const rollback = await request(app({rollbackEmailConfiguration: async () => previous, addAudit}, email)).post("/api/admin/settings/email/rollback").set("authorization", "Bearer super").expect(200);
    expect(rollback.body.active.id).toBe(1);
    expect(email.reload).toHaveBeenCalledTimes(2);
  });

  it("blocks private SMTP endpoints in production", async () => {
    const productionEnv = {...env, NODE_ENV: "production" as const};
    const response = await request(app({}, undefined, secrets, productionEnv)).patch("/api/admin/settings/email")
      .set("authorization", "Bearer super").send({...smtpSettings, host: "127.0.0.1", port: 587}).expect(422);
    expect(response.body).toEqual(expect.objectContaining({error: "SMTP_HOST_NOT_ALLOWED", requestId: expect.any(String)}));
  });

  it("never exposes a password through responses or server logs", async () => {
    const password = "smtp-password-must-not-leak";
    const setSecret = vi.fn().mockRejectedValue(new Error(`failed ${password}`));
    const secretProvider: SecretProvider = {getSecret: vi.fn(), isConfigured: vi.fn(), setSecret};
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await request(app({}, undefined, secretProvider)).patch("/api/admin/settings/email")
        .set("authorization", "Bearer super").send({...smtpSettings, smtpPassword: password}).expect(503);
      expect(JSON.stringify(response.body)).not.toContain(password);
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(password);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("complete nested client create and update", () => {
  it("creates a complete client and excludes gross income from the response", async () => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    const response = await request(app({createClient})).post("/api/clients")
      .set("authorization", "Bearer advisor").send(completeClientInput).expect(201);
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      numberOfBorrowers: 2, householdChildrenCount: 2, householdChildrenAges: [4, 8],
      loanPurpose: "SECOND_HAND_PURCHASE", householdLiabilities: expect.arrayContaining([
        expect.objectContaining({liabilityType: "LOAN", currentBalance: 120_000, monthlyPayment: 1_500, financialInstitutionEncrypted: expect.any(String)})
      ])
    }));
    expect(createClient.mock.calls[0][0].borrowers[0].additionalIncomes).toEqual([
      expect.objectContaining({sourceType: "RENTAL_INCOME", monthlyAmount: 2_500}),
      expect.objectContaining({sourceType: "SALARIED", monthlyAmount: 0})
    ]);
    expect(createClient.mock.calls[0][0].propertyAddressEncrypted).not.toContain(completeClientInput.property.address);
    expect(response.body).not.toHaveProperty("monthlyGrossIncome");
  });

  it.each([
    ["required field", {borrowers: [{...completeClientInput.borrowers[0], firstName: undefined}, completeClientInput.borrowers[1]]}, "borrowers.0.firstName"],
    ["one age per child", {household: {numberOfChildren: 2, childrenAges: [4]}}, "household.childrenAges"],
    ["additional income type", {borrowers: [{...completeClientInput.borrowers[0], income: {...completeClientInput.borrowers[0].income, additionalIncomes: [{type: null, monthlyAmount: 1000, description: null}]}}, completeClientInput.borrowers[1]]}, "borrowers.0.income.additionalIncomes.0.type"],
    ["nonnegative additional income amount", {borrowers: [{...completeClientInput.borrowers[0], income: {...completeClientInput.borrowers[0].income, additionalIncomes: [{type: "SALARIED", monthlyAmount: -1, description: null}]}}, completeClientInput.borrowers[1]]}, "borrowers.0.income.additionalIncomes.0.monthlyAmount"],
    ["liability balance", {householdLiabilities: [{...completeClientInput.householdLiabilities[0], currentBalance: undefined}, completeClientInput.householdLiabilities[1]]}, "householdLiabilities.0.currentBalance"],
    ["liability monthly payment", {householdLiabilities: [{...completeClientInput.householdLiabilities[0], monthlyPayment: undefined}, completeClientInput.householdLiabilities[1]]}, "householdLiabilities.0.monthlyPayment"],
    ["property address", {property: {...completeClientInput.property, address: undefined}}, "property.address"],
    ["valid loan purpose", {loanPurpose: "PURCHASE"}, "loanPurpose"]
  ])("rejects a missing or invalid %s with Hebrew field errors", async (_name, change, field) => {
    const response = await request(app()).post("/api/clients").set("authorization", "Bearer advisor")
      .send({...completeClientInput, ...change}).expect(400);
    expect(response.body).toEqual(expect.objectContaining({error: "VALIDATION_ERROR", requestId: expect.any(String)}));
    expect(response.body.fieldErrors[field]).toMatch(/[א-ת]/);
  });

  it("updates the complete client record without data loss", async () => {
    const existing = await makeStore().getClient(1);
    const updateClient = vi.fn().mockResolvedValue(existing);
    const response = await request(app({updateClient})).patch("/api/clients/1")
      .set("authorization", "Bearer advisor").send({...completeClientInput, household: {numberOfChildren: 2, childrenAges: [5, 9]}, borrowers: [{...completeClientInput.borrowers[0], employment: {...completeClientInput.borrowers[0].employment, jobTitle: "סמנכ״לית"}}, completeClientInput.borrowers[1]]}).expect(200);
    expect(updateClient).toHaveBeenCalledWith(1, expect.objectContaining({householdChildrenAges: [5, 9], borrowers: expect.arrayContaining([expect.objectContaining({jobTitle: "סמנכ״לית"})])}));
    expect(response.body).not.toHaveProperty("monthlyGrossIncome");
  });
});

describe("focused client updates", () => {
  const personal = {
    numberOfBorrowers: 2, borrowerRelationship: "MARRIED", borrowerRelationshipOther: null,
    household: completeClientInput.household,
    borrowers: completeClientInput.borrowers.map((borrower, index) => ({
      id: index + 1, order: borrower.order, isPrimary: borrower.isPrimary, firstName: borrower.firstName,
      lastName: borrower.lastName, identityNumber: borrower.identityNumber, dateOfBirth: borrower.dateOfBirth,
      phone: borrower.phone, email: borrower.email, city: borrower.city, streetAddress: borrower.streetAddress,
      maritalStatus: borrower.maritalStatus, children: borrower.children
    }))
  };
  const income = {borrowers: completeClientInput.borrowers.map((borrower, index) => ({id: index + 1, employment: borrower.employment, income: borrower.income}))};
  const liabilities = {borrowerRelationship: "MARRIED", borrowers: [{id: 1, liabilities: []}, {id: 2, liabilities: []}], householdLiabilities: completeClientInput.householdLiabilities};
  const property = {loanPurpose: completeClientInput.loanPurpose, property: completeClientInput.property, loanRequest: completeClientInput.loanRequest};

  it.each([
    ["personal", personal, "updateClientPersonal", "CLIENT_PERSONAL_UPDATED"],
    ["income", income, "updateClientIncome", "CLIENT_INCOME_UPDATED"],
    ["liabilities", liabilities, "updateClientLiabilities", "CLIENT_LIABILITIES_UPDATED"],
    ["property", property, "updateClientProperty", "CLIENT_PROPERTY_UPDATED"],
    ["deal-details", {dealDetails: "פירוט עסקה מעודכן"}, "updateClientDealDetails", "CLIENT_DEAL_DETAILS_UPDATED"]
  ])("updates only the %s section and writes a PII-free audit", async (path, payload, method, action) => {
    const existing = await makeStore().getClient(1);
    const update = vi.fn().mockResolvedValue(existing);
    const addAudit = vi.fn().mockResolvedValue(undefined);
    await request(app({[method]: update, addAudit})).patch(`/api/clients/1/${path}`).set("authorization", "Bearer advisor").send(payload).expect(200);
    expect(update).toHaveBeenCalledOnce();
    expect(addAudit).toHaveBeenCalledWith(1, action, "client", 1, expect.objectContaining({section: expect.any(String), fields: expect.any(Array)}), expect.any(String));
    const auditMetadata = JSON.stringify(addAudit.mock.calls[0][4]);
    expect(auditMetadata).not.toContain("123456789");
    expect(auditMetadata).not.toContain("0501234567");
    expect(auditMetadata).not.toContain("פירוט עסקה מעודכן");
  });

  it.each([
    ["SEPARATED", "SALARIED"],
    ["MARRIED", "GOVERNMENT_EMPLOYEE"],
    ["MARRIED", "SECURITY_FORCES"]
  ])("rejects legacy marital/employment values for new cases", async (maritalStatus, employmentType) => {
    const basePayload = {
      ...completeClientInput,
      borrowers: [{
        ...completeClientInput.borrowers[0],
        maritalStatus,
        employment: {...completeClientInput.borrowers[0].employment, employmentType}
      }, completeClientInput.borrowers[1]]
    };
    const payload = maritalStatus === "SEPARATED" ? {
      ...basePayload,
      numberOfBorrowers: 1,
      borrowerRelationship: null,
      household: {numberOfChildren: 0, childrenAges: []},
      householdLiabilities: [],
      borrowers: [{...basePayload.borrowers[0], children: {numberOfChildren: 0, childrenAges: []}, liabilities: completeClientInput.householdLiabilities}]
    } : basePayload;
    const response = await request(app()).post("/api/clients").set("authorization", "Bearer advisor").send(payload).expect(400);
    expect(response.body).toEqual(expect.objectContaining({error: "VALIDATION_ERROR", requestId: expect.any(String)}));
  });

  it("accepts rent without balances and rejects irrelevant or missing conditional fields", async () => {
    const rent = {...completeClientInput.householdLiabilities[0], type: "RENT", financialInstitution: null, currentBalance: null};
    const existing = await makeStore().getClient(1);
    await request(app({createClient: vi.fn().mockResolvedValue(existing)})).post("/api/clients")
      .set("authorization", "Bearer advisor").send({...completeClientInput, householdLiabilities: [rent]}).expect(201);
    await request(app()).post("/api/clients").set("authorization", "Bearer advisor")
      .send({...completeClientInput, householdLiabilities: [{...rent, currentBalance: 0}]}).expect(400);
    await request(app()).post("/api/clients").set("authorization", "Bearer advisor")
      .send({...completeClientInput, householdLiabilities: [{...completeClientInput.householdLiabilities[0], financialInstitution: null}]}).expect(400);
  });

  it("rejects a raw PATCH that changes liability type but leaves stale institution/balance values, and never writes it", async () => {
    const updateClientLiabilities = vi.fn();
    const staleAfterTypeChange = {
      borrowerRelationship: "MARRIED",
      borrowers: [{id: 1, liabilities: []}, {id: 2, liabilities: []}],
      householdLiabilities: [{
        type: "RENT",
        otherTypeDescription: null,
        financialInstitution: "בנק לדוגמה",
        currentBalance: 120_000,
        monthlyPayment: 1_500,
        endDate: "2035-07-31",
        notes: "הועבר משכירות שגוי"
      }]
    };
    const response = await request(app({updateClientLiabilities})).patch("/api/clients/1/liabilities")
      .set("authorization", "Bearer advisor").send(staleAfterTypeChange).expect(400);
    expect(response.body).toEqual(expect.objectContaining({error: "VALIDATION_ERROR", requestId: expect.any(String)}));
    expect(updateClientLiabilities).not.toHaveBeenCalled();
  });

  it("enforces authentication, advisor role and client ownership", async () => {
    await request(app()).patch("/api/clients/1/property").send(property).expect(401);
    await request(app()).patch("/api/clients/1/property").set("authorization", "Bearer advisor2").send(property).expect(403);
    await request(app()).patch("/api/clients/1/property").set("authorization", "Bearer super").send(property).expect(403);
  });

  it("returns Hebrew field validation errors without calling the store", async () => {
    const updateClientProperty = vi.fn();
    const response = await request(app({updateClientProperty})).patch("/api/clients/1/property").set("authorization", "Bearer advisor")
      .send({...property, property: {...property.property, address: ""}}).expect(400);
    expect(response.body).toEqual(expect.objectContaining({error: "VALIDATION_ERROR", requestId: expect.any(String)}));
    expect(response.body.fieldErrors["property.address"]).toMatch(/[א-ת]/);
    expect(updateClientProperty).not.toHaveBeenCalled();
  });

  it("does not write an audit when the transactional store update fails", async () => {
    const addAudit = vi.fn();
    await request(app({updateClientIncome: vi.fn().mockRejectedValue(new Error("transaction failed")), addAudit}))
      .patch("/api/clients/1/income").set("authorization", "Bearer advisor").send(income).expect(500);
    expect(addAudit).not.toHaveBeenCalled();
  });
});

describe("multi-borrower client create and update", () => {
  it("creates every borrower in one nested encrypted record", async () => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    const response = await request(app({createClient})).post("/api/clients")
      .set("authorization", "Bearer advisor").send(completeClientInput).expect(201);
    const record = createClient.mock.calls[0][0];
    expect(record).toEqual(expect.objectContaining({numberOfBorrowers: 2, borrowerRelationship: "MARRIED", householdChildrenCount: 2, loanPurpose: "SECOND_HAND_PURCHASE"}));
    expect(record.borrowers).toHaveLength(2);
    expect(record.borrowers[0]).toEqual(expect.objectContaining({borrowerOrder: 1, isPrimary: true, employmentType: "SALARIED", liabilities: []}));
    expect(record.borrowers[1]).toEqual(expect.objectContaining({borrowerOrder: 2, isPrimary: false, employmentType: "SELF_EMPLOYED"}));
    expect(record.borrowers[0].identityNumberEncrypted).not.toContain("123456789");
    expect(record.propertyAddressEncrypted).not.toContain(completeClientInput.property.address);
    expect(response.body.borrowers).toHaveLength(2);
  });

  it("canonicalizes married borrower status and address before persistence", async () => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    const payload = {
      ...completeClientInput,
      borrowers: completeClientInput.borrowers.map((borrower, index) => ({
        ...borrower,
        maritalStatus: index === 0 ? undefined : "SINGLE",
        city: index === 0 ? "עיר משותפת" : "עיר עוקפת",
        streetAddress: index === 0 ? "רחוב משותף 1" : "רחוב עוקף 2"
      }))
    };
    await request(app({createClient})).post("/api/clients").set("authorization", "Bearer advisor").send(payload).expect(201);
    expect(createClient.mock.calls[0][0].borrowers.map((item: {maritalStatus: string}) => item.maritalStatus)).toEqual(["MARRIED", "MARRIED"]);
    const encryption = new EncryptionService(Buffer.alloc(32, 4));
    expect(createClient.mock.calls[0][0].borrowers.map((item: {cityEncrypted: string}) => encryption.decrypt(item.cityEncrypted))).toEqual(["עיר משותפת", "עיר משותפת"]);
    expect(createClient.mock.calls[0][0].borrowers.map((item: {streetAddressEncrypted: string}) => encryption.decrypt(item.streetAddressEncrypted))).toEqual(["רחוב משותף 1", "רחוב משותף 1"]);
  });

  it.each([
    ["negative amount", {property: {...completeClientInput.property, value: -1}}],
    ["negative decimal", {loanRequest: {requestedAmount: "-0.01"}}],
    ["signed amount", {loanRequest: {requestedAmount: "+100"}}],
    ["scientific notation", {property: {...completeClientInput.property, value: "1e3"}}],
    ["decimal borrower count", {numberOfBorrowers: "2.5"}]
  ])("rejects %s sent directly to the API", async (_name, change) => {
    await request(app()).post("/api/clients").set("authorization", "Bearer advisor").send({...completeClientInput, ...change}).expect(400);
  });

  it.each([
    ["duplicate identity", {...completeClientInput, borrowers: [completeClientInput.borrowers[0], {...completeClientInput.borrowers[1], identityNumber: "123456789"}]}],
    ["future birth date", {...completeClientInput, borrowers: [{...completeClientInput.borrowers[0], dateOfBirth: "2099-01-01"}, completeClientInput.borrowers[1]]}],
    ["missing relationship", {...completeClientInput, borrowerRelationship: null}],
    ["missing second birth date", {...completeClientInput, borrowers: [completeClientInput.borrowers[0], {...completeClientInput.borrowers[1], dateOfBirth: undefined}]}],
    ["underage second borrower", {...completeClientInput, borrowers: [completeClientInput.borrowers[0], {...completeClientInput.borrowers[1], dateOfBirth: "2015-01-01"}]}],
    ["more than five borrowers", {...completeClientInput, numberOfBorrowers: 6, borrowers: Array.from({length: 6}, (_, index) => ({...completeClientInput.borrowers[0], identityNumber: String(100000000 + index)}))}]
  ])("rejects %s", async (_name, payload) => {
    const response = await request(app()).post("/api/clients").set("authorization", "Bearer advisor").send(payload).expect(400);
    expect(response.body).toEqual(expect.objectContaining({error: "VALIDATION_ERROR", requestId: expect.any(String)}));
  });

  it.each([
    ["one borrower", {...completeClientInput, numberOfBorrowers: 1, borrowerRelationship: null, household: {numberOfChildren: 0, childrenAges: []}, householdLiabilities: [], borrowers: [{...completeClientInput.borrowers[0], children: {numberOfChildren: 2, childrenAges: [4, 8]}, liabilities: completeClientInput.householdLiabilities}]}],
    ["common law", {...completeClientInput, borrowerRelationship: "COMMON_LAW", householdLiabilities: [], borrowers: completeClientInput.borrowers.map((borrower, index) => ({...borrower, liabilities: index === 0 ? completeClientInput.householdLiabilities : []}))}],
    ["family with separate children", {...completeClientInput, borrowerRelationship: "FAMILY", household: {numberOfChildren: 0, childrenAges: []}, householdLiabilities: [], borrowers: completeClientInput.borrowers.map((borrower, index) => ({...borrower, children: {numberOfChildren: 1, childrenAges: [index + 5]}, liabilities: index === 0 ? completeClientInput.householdLiabilities : []}))}]
  ])("creates %s structure", async (_name, payload) => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    await request(app({createClient})).post("/api/clients").set("authorization", "Bearer advisor").send(payload).expect(201);
    expect(createClient).toHaveBeenCalledOnce();
  });

  it("updates borrower order and financial data without accepting advisorId", async () => {
    const existing = await makeStore().getClient(1);
    const updateClient = vi.fn().mockResolvedValue(existing);
    const reorderedBorrowers = [{...completeClientInput.borrowers[1], order: 1, isPrimary: true}, {...completeClientInput.borrowers[0], order: 2, isPrimary: false}];
    const payload = {...completeClientInput, advisorId: 999, borrowers: reorderedBorrowers};
    await request(app({updateClient})).patch("/api/clients/1").set("authorization", "Bearer advisor").send(payload).expect(400);
    const validPayload = {...completeClientInput, borrowers: reorderedBorrowers};
    await request(app({updateClient})).patch("/api/clients/1").set("authorization", "Bearer advisor").send(validPayload).expect(200);
    expect(updateClient.mock.calls[0][1].borrowers[0]).toEqual(expect.objectContaining({borrowerOrder: 1, isPrimary: true}));
  });
});

describe("documents", () => {
  it("rejects an upload without a file", async () => { await request(app()).post("/api/clients/1/documents").set("authorization", "Bearer advisor").expect(400); });
  it("accepts a real PDF signature", async () => { await request(app()).post("/api/clients/1/documents").set("authorization", "Bearer advisor").field("documentType", "ID_FRONT").field("borrowerId", "1").attach("file", Buffer.from("%PDF-1.7\ncontent"), {filename: "file.pdf", contentType: "application/pdf"}).expect(201); });
  it("rejects a fake MIME type", async () => { await request(app()).post("/api/clients/1/documents").set("authorization", "Bearer advisor").attach("file", Buffer.from("not a pdf"), {filename: "file.pdf", contentType: "application/pdf"}).expect(400); });
  it("blocks document download by another advisor", async () => { await request(app()).get("/api/documents/1/download").set("authorization", "Bearer advisor2").expect(403); });
  it("requires a custom title for another document", async () => { await request(app()).post("/api/clients/1/documents").set("authorization", "Bearer advisor").field("documentType", "OTHER").attach("file", Buffer.from("%PDF-1.7\ncontent"), {filename: "file.pdf", contentType: "application/pdf"}).expect(400); });
});

describe("lender isolation", () => {
  it("requires authentication for replies and identity requests", async () => {
    await request(app()).post("/api/lender/submissions/1/reply").expect(401);
    await request(app()).post("/api/lender/submissions/1/identity-request").expect(401);
  });
  it("no longer exposes an offer-submission endpoint for lenders", async () => {
    await request(app()).post("/api/lender/submissions/1/offers").set("authorization", "Bearer lender").send({amount: 1_000_000, interestRate: 6.5, termMonths: 240}).expect(404);
  });
  it("blocks a lender from another company", async () => { await request(app()).get("/api/lender/submissions/1").set("authorization", "Bearer lender2").expect(403); });
  it("allows the assigned lender and does not expose PII", async () => {
    const response = await request(app()).get("/api/lender/submissions/1").set("authorization", "Bearer lender").expect(200);
    expect(response.body.anonymousSnapshot).toEqual(expect.objectContaining({publicCaseNumber: "SC-1"}));
    expect(JSON.stringify(response.body)).not.toMatch(/Dana|0500000000|dana@example/);
  });
  it("creates replies with the authenticated user", async () => {
    await request(app()).post("/api/lender/submissions/1/reply").set("authorization", "Bearer lender").send({responseType: "MESSAGE", message: "Reviewing"}).expect(201);
  });
  it("returns only approved identity fields", async () => {
    const encryption = new EncryptionService(Buffer.alloc(32, 4));
    const response = await request(app({
      getRevealedData: async () => ({clientId: 1, approvedFields: ["PHONE"], approvedDocumentIds: []}),
      getIdentityData: async () => ({
        firstNameEncrypted: encryption.encrypt("Dana"), lastNameEncrypted: encryption.encrypt("Levi"),
        phoneEncrypted: encryption.encrypt("0500000000"), emailEncrypted: encryption.encrypt("dana@example.com"),
        identityNumberEncrypted: encryption.encrypt("123456789"), propertyAddressEncrypted: encryption.encrypt("Street 1"),
        employerNameEncrypted: encryption.encrypt("Employer")
      })
    })).get("/api/lender/submissions/1/revealed-data").set("authorization", "Bearer lender").expect(200);
    expect(response.body.data).toEqual({phone: "0500000000"});
    expect(JSON.stringify(response.body)).not.toMatch(/Dana|dana@example|123456789|Employer/);
  });
  it("blocks an unapproved lender document", async () => {
    await request(app({getRevealedData: async () => ({clientId: 1, approvedFields: [], approvedDocumentIds: []})}))
      .get("/api/lender/submissions/1/documents/1/download").set("authorization", "Bearer lender").expect(403);
  });
});

describe("invites", () => {
  it("returns 410 for expired invites", async () => {
    await request(app({validateInvite: async () => ({tokenId: 1, submissionId: 1, lenderId: 100, lenderName: "Lender", expiresAt: new Date(0), usedAt: null, revokedAt: null})}))
      .post("/api/lender/invites/validate").send({token: "x".repeat(32)}).expect(410);
  });
  it("returns 403 for revoked and used invites", async () => {
    await request(app({validateInvite: async () => ({tokenId: 1, submissionId: 1, lenderId: 100, lenderName: "Lender", expiresAt: new Date(Date.now() + 10000), usedAt: null, revokedAt: new Date()})}))
      .post("/api/lender/invites/validate").send({token: "x".repeat(32)}).expect(403);
    await request(app({validateInvite: async () => ({tokenId: 1, submissionId: 1, lenderId: 100, lenderName: "Lender", expiresAt: new Date(Date.now() + 10000), usedAt: new Date(), revokedAt: null})}))
      .post("/api/lender/invites/validate").send({token: "x".repeat(32)}).expect(403);
  });
  it("returns only minimal public invite data", async () => {
    const response = await request(app({validateInvite: async () => ({tokenId: 1, submissionId: 99, lenderId: 100, lenderName: "Lender", expiresAt: new Date(Date.now() + 10000), usedAt: null, revokedAt: null})}))
      .post("/api/lender/invites/validate").send({token: "x".repeat(32)}).expect(200);
    expect(response.body).toEqual({lenderName: "Lender", requiresAuthentication: true});
  });
  it("rate limits repeated public validation", async () => {
    const application = app({validateInvite: async () => null});
    for (let index = 0; index < 20; index += 1) {
      await request(application).post("/api/lender/invites/validate").send({token: "x".repeat(32)}).expect(404);
    }
    await request(application).post("/api/lender/invites/validate").send({token: "x".repeat(32)}).expect(429);
  });
});

describe("submission delivery", () => {
  const snapshotSource = {publicCaseNumber: "SC-1", loanPurpose: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyCity: "תל אביב", propertyValue: 2_000_000, requestedAmount: 1_000_000, numberOfBorrowers: 2, borrowerRelationship: "MARRIED", employmentTypes: ["SALARIED", "SELF_EMPLOYED"], borrowerBirthDatesEncrypted: [null, null], borrowerBirthDates: [new Date("1985-06-15"), new Date("1987-08-20")], totalMonthlyIncome: 50_000, liabilityCount: 1, totalLiabilityBalance: 400_000, totalMonthlyPayments: 6_000, liabilityTypeBreakdown: {MORTGAGE: 1}};

  it("blocks delivery before creating a submission when production email is disabled", async () => {
    const createSubmission = vi.fn();
    const response = await request(app(
      {createSubmission},
      undefined,
      secrets,
      {...env, EMAIL_DELIVERY_ENABLED: false, SMTP_HOST: "", EMAIL_FROM: "", EMAIL_REPLY_TO: ""}
    )).post("/api/clients/1/submissions").set("authorization", "Bearer advisor").send({lenderIds: [100]}).expect(503);
    expect(response.body).toEqual(expect.objectContaining({error: "EMAIL_DELIVERY_DISABLED", requestId: expect.any(String)}));
    expect(createSubmission).not.toHaveBeenCalled();
  });
  it("marks a successful SMTP delivery as SENT without creating an automatic response", async () => {
    const markSent = vi.fn().mockResolvedValue(undefined);
    const createResponse = vi.fn();
    const response = await request(app({
      listLenders: async () => [{id: 100, name: "Lender", contactEmail: "lender@test"}],
      getSnapshotSource: async () => snapshotSource,
      createSubmission: async () => ({id: 50}), markSubmissionSent: markSent,
      createLenderResponse: createResponse
    })).post("/api/clients/1/submissions").set("authorization", "Bearer advisor").send({lenderIds: [100]}).expect(201);
    expect(response.body.results).toEqual([{lenderId: 100, status: "SENT"}]);
    expect(markSent).toHaveBeenCalledWith(50, "message-1", "lender@test");
    expect(createResponse).not.toHaveBeenCalled();
  });

  it("marks SMTP failure as DELIVERY_FAILED", async () => {
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const email = {verify: vi.fn(), send: vi.fn().mockRejectedValue(new Error("smtp password secret"))};
    const response = await request(app({
      listLenders: async () => [{id: 100, name: "Lender", contactEmail: "lender@test"}],
      getSnapshotSource: async () => snapshotSource,
      createSubmission: async () => ({id: 51}), markSubmissionDeliveryFailed: markFailed
    }, email)).post("/api/clients/1/submissions").set("authorization", "Bearer advisor").send({lenderIds: [100]}).expect(201);
    expect(response.body.results).toEqual([{lenderId: 100, status: "DELIVERY_FAILED"}]);
    expect(markFailed).toHaveBeenCalledWith(51, "lender@test", "Email delivery failed");
  });

  it("returns 422 and creates no submission or email when required documents are missing", async () => {
    const createSubmission = vi.fn(); const send = vi.fn();
    const response = await request(app({
      listMissingRequiredDocuments: async () => [{documentType: "ID_BACK", borrowerId: 2, borrowerOrder: 2, label: "תעודת זהות — צד אחורי — לווה 2"}],
      createSubmission
    }, {verify: vi.fn(), send})).post("/api/clients/1/submissions").set("authorization", "Bearer advisor").send({lenderIds: [100]}).expect(422);
    expect(response.body).toEqual(expect.objectContaining({code: "MISSING_REQUIRED_DOCUMENTS", missingDocuments: [expect.objectContaining({documentType: "ID_BACK", borrowerId: 2})]}));
    expect(createSubmission).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });

  it("returns 422 and creates no side effects for incomplete legacy liabilities", async () => {
    const createSubmission = vi.fn(); const send = vi.fn();
    const response = await request(app({
      hasIncompleteLegacyLiabilities: async () => true,
      createSubmission
    }, {verify: vi.fn(), send})).post("/api/clients/1/submissions").set("authorization", "Bearer advisor").send({lenderIds: [100]}).expect(422);
    expect(response.body).toEqual(expect.objectContaining({
      code: "INCOMPLETE_LEGACY_LIABILITIES",
      message: expect.stringContaining("ההתחייבויות")
    }));
    expect(createSubmission).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
});

describe("forgot password", () => {
  it("returns the same generic message and audits PASSWORD_RESET_REQUESTED for an existing, active email", async () => {
    const targetEmail = "advisor@example.com";
    const findUserByEmail = vi.fn().mockResolvedValue({...users.advisor, email: targetEmail});
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const response = await request(app({findUserByEmail, addAudit})).post("/api/auth/forgot-password")
      .send({email: targetEmail}).expect(200);
    expect(response.body).toEqual({success: true, message: expect.stringContaining("אם קיים חשבון")});
    expect(addAudit).toHaveBeenCalledWith(null, "PASSWORD_RESET_REQUESTED", "user", users.advisor.id, {source: "self_service"}, expect.any(String), expect.any(String), undefined);
    // ה-helper המקומי app() לא מזריק passwordReset מותאם אישית, לכן בודקים רק שהתשובה עקבית ושלא נחשפה כתובת הדוא״ל בהודעה עצמה.
    expect(response.body.message).not.toContain(targetEmail);
  });

  it("returns the identical generic message for an email that does not exist (anti-enumeration)", async () => {
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const response = await request(app({addAudit})).post("/api/auth/forgot-password")
      .send({email: "no-such-account@example.com"}).expect(200);
    expect(response.body).toEqual({success: true, message: expect.stringContaining("אם קיים חשבון")});
    expect(addAudit).toHaveBeenCalledWith(null, "PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL", "user", null, {}, expect.any(String), expect.any(String), undefined);
  });

  it("rejects a malformed email before touching the store", async () => {
    const findUserByEmail = vi.fn();
    await request(app({findUserByEmail})).post("/api/auth/forgot-password").send({email: "not-an-email"}).expect(400);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("does not send a reset link for an archived (soft-deleted) account, but still returns the generic message", async () => {
    const targetEmail = "archived@example.com";
    const archivedUser = {...users.advisor, email: targetEmail, deletedAt: new Date()};
    const findUserByEmail = vi.fn().mockResolvedValue(archivedUser);
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const response = await request(app({findUserByEmail, addAudit})).post("/api/auth/forgot-password")
      .send({email: targetEmail}).expect(200);
    expect(response.body).toEqual({success: true, message: expect.stringContaining("אם קיים חשבון")});
    expect(addAudit).toHaveBeenCalledWith(null, "PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL", "user", null, {}, expect.any(String), expect.any(String), undefined);
  });
});

describe("SUPER_ADMIN user management", () => {
  it("records an optional reason and the correct action name when disabling a user", async () => {
    const updateAdvisorStatus = vi.fn().mockResolvedValue({...users.advisor, status: "DISABLED"});
    const addAudit = vi.fn().mockResolvedValue(undefined);
    await request(app({updateAdvisorStatus, addAudit})).patch(`/api/admin/advisors/${users.advisor.id}/status`)
      .set("authorization", "Bearer super").send({status: "DISABLED", reason: "בקשת הלקוח"}).expect(200);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "USER_DISABLED", "user", users.advisor.id, {previousStatus: "ACTIVE", reason: "בקשת הלקוח"}, expect.any(String), expect.any(String), undefined);
  });

  it("uses USER_ENABLED / USER_SUSPENDED for the other two status transitions", async () => {
    const addAudit = vi.fn().mockResolvedValue(undefined);
    await request(app({addAudit})).patch(`/api/admin/advisors/${users.advisor.id}/status`).set("authorization", "Bearer super").send({status: "SUSPENDED"}).expect(200);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "USER_SUSPENDED", "user", users.advisor.id, {previousStatus: "ACTIVE", reason: null}, expect.any(String), expect.any(String), undefined);
    await request(app({addAudit})).patch(`/api/admin/advisors/${users.advisor.id}/status`).set("authorization", "Bearer super").send({status: "ACTIVE"}).expect(200);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "USER_ENABLED", "user", users.advisor.id, {previousStatus: "ACTIVE", reason: null}, expect.any(String), expect.any(String), undefined);
  });

  it("blocks non-SUPER_ADMIN roles from every new advisor-management route", async () => {
    for (const token of ["admin", "advisor", "lender"]) {
      await request(app()).patch(`/api/admin/advisors/${users.advisor.id}/profile`).set("authorization", `Bearer ${token}`).send({firstName: "X", lastName: "Y", phone: "0500000000", businessName: "B"}).expect(403);
      await request(app()).patch(`/api/admin/advisors/${users.advisor.id}/email`).set("authorization", `Bearer ${token}`).send({email: "new@example.com"}).expect(403);
      await request(app()).post(`/api/admin/advisors/${users.advisor.id}/send-password-reset`).set("authorization", `Bearer ${token}`).expect(403);
      await request(app()).post(`/api/admin/advisors/${users.advisor.id}/archive`).set("authorization", `Bearer ${token}`).expect(403);
      await request(app()).post(`/api/admin/advisors/${users.advisor.id}/restore`).set("authorization", `Bearer ${token}`).expect(403);
    }
  });

  it("edits an advisor's profile fields and audits USER_UPDATED", async () => {
    const updateAdvisorProfile = vi.fn().mockResolvedValue({...users.advisor, firstName: "Renamed"});
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const response = await request(app({updateAdvisorProfile, addAudit})).patch(`/api/admin/advisors/${users.advisor.id}/profile`)
      .set("authorization", "Bearer super").send({firstName: "Renamed", lastName: "One", phone: "0500000000", businessName: "Business"}).expect(200);
    expect(response.body.firstName).toBe("Renamed");
    expect(updateAdvisorProfile).toHaveBeenCalledWith(users.advisor.id, expect.objectContaining({firstName: "Renamed", lastName: "One"}));
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "USER_UPDATED", "user", users.advisor.id, expect.objectContaining({adminTriggered: true}), expect.any(String), expect.any(String), undefined);
  });

  it("archives then restores an advisor, and audits both transitions", async () => {
    const encryption = new EncryptionService(Buffer.alloc(32, 4));
    const fullAccount = (patch: Partial<Record<string, unknown>>) => ({
      ...users.advisor, phoneEncrypted: encryption.encrypt("+972501234567"), businessName: "Test Business",
      businessPhoneEncrypted: encryption.encrypt("+972501234567"), businessEmail: users.advisor.email,
      createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null, ...patch
    });
    const archiveAdvisorAccount = vi.fn().mockResolvedValue(fullAccount({deletedAt: new Date()}));
    const restoreAdvisorAccount = vi.fn().mockResolvedValue(fullAccount({deletedAt: null}));
    const addAudit = vi.fn().mockResolvedValue(undefined);
    await request(app({archiveAdvisorAccount, addAudit})).post(`/api/admin/advisors/${users.advisor.id}/archive`)
      .set("authorization", "Bearer super").send({reason: "כפל חשבון"}).expect(200);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "USER_ARCHIVED", "user", users.advisor.id, {reason: "כפל חשבון"}, expect.any(String), expect.any(String), undefined);
    await request(app({getAdvisorAccount: async (_id, options) => options?.includeArchived ? fullAccount({deletedAt: new Date()}) : null, restoreAdvisorAccount, addAudit}))
      .post(`/api/admin/advisors/${users.advisor.id}/restore`).set("authorization", "Bearer super").expect(200);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "USER_RESTORED", "user", users.advisor.id, {}, expect.any(String), expect.any(String), undefined);
  });

  it("rejects an email change to an address already in use, without touching Firebase", async () => {
    const targetEmail = "advisor2@example.com";
    const findUserByEmail = vi.fn().mockResolvedValue({...users.advisor2, email: targetEmail});
    const updateUserEmail = vi.fn();
    await request(app({findUserByEmail}, undefined, secrets, env, undefined, {deleteUser: vi.fn(), updateUserEmail}))
      .patch(`/api/admin/advisors/${users.advisor.id}/email`).set("authorization", "Bearer super").send({email: targetEmail}).expect(409);
    expect(updateUserEmail).not.toHaveBeenCalled();
  });
});

describe("legal documents", () => {
  it("exposes only the published fields of the active version publicly, and 404s when none is published", async () => {
    const getActiveLegalDocumentVersion = vi.fn().mockResolvedValue({
      id: 1, documentType: "TERMS", versionNumber: 1, status: "PUBLISHED", title: "תנאי שימוש", content: "תוכן",
      contactEmail: "syncash.support@gmail.com", contactPhone: null, contactAddress: null, effectiveDate: "2026-08-01",
      contentHash: "hash", createdByUserId: users.super.id, publishedByUserId: users.super.id, publishedAt: new Date(), archivedAt: null, createdAt: new Date(), updatedAt: new Date()
    });
    const response = await request(app({getActiveLegalDocumentVersion})).get("/api/legal-documents/TERMS").expect(200);
    expect(response.body).toEqual(expect.objectContaining({title: "תנאי שימוש", content: "תוכן"}));
    expect(response.body).not.toHaveProperty("createdByUserId");
    expect(response.body).not.toHaveProperty("status");
    await request(app({getActiveLegalDocumentVersion: async () => null})).get("/api/legal-documents/PRIVACY").expect(404);
  });

  it("refuses to edit or publish a version that is not a draft", async () => {
    const getLegalDocumentVersion = vi.fn().mockResolvedValue({
      id: 2, documentType: "TERMS", versionNumber: 1, status: "PUBLISHED", title: "t", content: "c",
      contactEmail: null, contactPhone: null, contactAddress: null, effectiveDate: null, contentHash: "h",
      createdByUserId: users.super.id, publishedByUserId: users.super.id, publishedAt: new Date(), archivedAt: null, createdAt: new Date(), updatedAt: new Date()
    });
    await request(app({getLegalDocumentVersion})).patch("/api/admin/legal-documents/versions/2")
      .set("authorization", "Bearer super").send({title: "t2", content: "c2", contactEmail: null, contactPhone: null, contactAddress: null, effectiveDate: null}).expect(409);
    await request(app({getLegalDocumentVersion})).post("/api/admin/legal-documents/versions/2/publish").set("authorization", "Bearer super").expect(409);
    await request(app({getLegalDocumentVersion})).delete("/api/admin/legal-documents/versions/2").set("authorization", "Bearer super").expect(409);
  });

  it("refuses to publish a draft with empty content", async () => {
    const getLegalDocumentVersion = vi.fn().mockResolvedValue({
      id: 3, documentType: "PRIVACY", versionNumber: 1, status: "DRAFT", title: "t", content: "   ",
      contactEmail: null, contactPhone: null, contactAddress: null, effectiveDate: null, contentHash: null,
      createdByUserId: users.super.id, publishedByUserId: null, publishedAt: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date()
    });
    await request(app({getLegalDocumentVersion})).post("/api/admin/legal-documents/versions/3/publish").set("authorization", "Bearer super").expect(422);
  });

  it("audits TERMS_VERSION_PUBLISHED / PRIVACY_VERSION_PUBLISHED with the content hash on successful publish", async () => {
    const draft = {
      id: 4, documentType: "PRIVACY" as const, versionNumber: 2, status: "DRAFT" as const, title: "t", content: "content",
      contactEmail: null, contactPhone: null, contactAddress: null, effectiveDate: null, contentHash: null,
      createdByUserId: users.super.id, publishedByUserId: null, publishedAt: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date()
    };
    const getLegalDocumentVersion = vi.fn().mockResolvedValue(draft);
    const publishLegalDocumentVersion = vi.fn().mockResolvedValue({...draft, status: "PUBLISHED", contentHash: "abc123", publishedAt: new Date(), publishedByUserId: users.super.id});
    const addAudit = vi.fn().mockResolvedValue(undefined);
    await request(app({getLegalDocumentVersion, publishLegalDocumentVersion, addAudit})).post("/api/admin/legal-documents/versions/4/publish")
      .set("authorization", "Bearer super").expect(200);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "PRIVACY_VERSION_PUBLISHED", "legal_document_version", 4, expect.objectContaining({documentType: "PRIVACY", versionNumber: 2, contentHash: "abc123"}), expect.any(String), expect.any(String), undefined);
  });

  it("only records acceptance for document types that currently have a published version", async () => {
    const createAdvisorAccount = vi.fn().mockResolvedValue(registeredAdvisor);
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const getActiveLegalDocumentVersion = vi.fn().mockImplementation(async (type: string) => type === "TERMS" ? {id: 9, documentType: "TERMS", versionNumber: 1} : null);
    const recordLegalDocumentAcceptance = vi.fn().mockResolvedValue(undefined);
    const createVerificationLink = vi.fn().mockResolvedValue({url: "http://localhost:9099/verify?oobCode=private"});
    await request(app({createAdvisorAccount, addEmailLog, getActiveLegalDocumentVersion, recordLegalDocumentAcceptance}, undefined, secrets, env, new AdvisorEmailVerificationService({createVerificationLink}, {send: vi.fn().mockResolvedValue({messageId: "m"})} as never, makeStore())))
      .post("/api/auth/register-advisor").set("authorization", "Bearer new-advisor").send(registrationInput).expect(201);
    expect(recordLegalDocumentAcceptance).toHaveBeenCalledTimes(1);
    expect(recordLegalDocumentAcceptance).toHaveBeenCalledWith(registeredAdvisor.id, "TERMS", 9, expect.objectContaining({}));
  });
});

describe("privacy requests", () => {
  it("accepts a public, unauthenticated submission and audits it with a null actor", async () => {
    const createPrivacyRequest = vi.fn().mockResolvedValue({id: 5, requestType: "DELETION", name: "לקוח קצה", email: "client@example.com", description: null, status: "NEW", internalNotes: null, handledByUserId: null, createdAt: new Date(), updatedAt: new Date()});
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const response = await request(app({createPrivacyRequest, addAudit})).post("/api/privacy-requests")
      .send({requestType: "DELETION", name: "לקוח קצה", email: "client@example.com"}).expect(201);
    expect(response.body).toEqual({success: true});
    expect(createPrivacyRequest).toHaveBeenCalledWith({requestType: "DELETION", name: "לקוח קצה", email: "client@example.com", description: null});
    expect(addAudit).toHaveBeenCalledWith(null, "PRIVACY_REQUEST_CREATED", "privacy_request", 5, {requestType: "DELETION"}, expect.any(String), expect.any(String), undefined);
  });

  it("rejects an invalid submission before touching the store", async () => {
    const createPrivacyRequest = vi.fn();
    await request(app({createPrivacyRequest})).post("/api/privacy-requests").send({requestType: "DELETION", name: "א", email: "not-an-email"}).expect(400);
    expect(createPrivacyRequest).not.toHaveBeenCalled();
  });

  it("requires SUPER_ADMIN for every admin privacy-request route", async () => {
    await request(app()).get("/api/admin/privacy-requests").set("authorization", "Bearer advisor").expect(403);
    await request(app()).get("/api/admin/privacy-requests/1").set("authorization", "Bearer advisor").expect(403);
    await request(app()).patch("/api/admin/privacy-requests/1").set("authorization", "Bearer advisor").send({status: "IN_REVIEW"}).expect(403);
  });

  it("404s for a privacy request that does not exist", async () => {
    const getPrivacyRequest = vi.fn().mockResolvedValue(null);
    await request(app({getPrivacyRequest})).get("/api/admin/privacy-requests/999").set("authorization", "Bearer super").expect(404);
    await request(app({getPrivacyRequest})).patch("/api/admin/privacy-requests/999").set("authorization", "Bearer super").send({status: "IN_REVIEW"}).expect(404);
  });

  it("updates status and internal notes, and audits PRIVACY_REQUEST_UPDATED with the acting SUPER_ADMIN", async () => {
    const existing = {id: 7, requestType: "VIEW", name: "פונה", email: "requester@example.com", description: null, status: "NEW", internalNotes: null, handledByUserId: null, createdAt: new Date(), updatedAt: new Date()};
    const getPrivacyRequest = vi.fn().mockResolvedValue(existing);
    const updatePrivacyRequestStatus = vi.fn().mockResolvedValue({...existing, status: "COMPLETED", internalNotes: "טופל בטלפון", handledByUserId: users.super.id});
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const response = await request(app({getPrivacyRequest, updatePrivacyRequestStatus, addAudit})).patch("/api/admin/privacy-requests/7")
      .set("authorization", "Bearer super").send({status: "COMPLETED", internalNotes: "טופל בטלפון"}).expect(200);
    expect(response.body).toEqual(expect.objectContaining({status: "COMPLETED", internalNotes: "טופל בטלפון"}));
    expect(updatePrivacyRequestStatus).toHaveBeenCalledWith(7, {status: "COMPLETED", internalNotes: "טופל בטלפון"}, users.super.id);
    expect(addAudit).toHaveBeenCalledWith(users.super.id, "PRIVACY_REQUEST_UPDATED", "privacy_request", 7, {status: "COMPLETED"}, expect.any(String), expect.any(String), undefined);
  });
});

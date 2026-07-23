import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { EmailService, resolveSmtpTransportSettings, SmtpServiceError } from "../../src/services/email";
import { AdvisorEmailVerificationService, type EmailVerificationService } from "../../src/services/emailVerification";
import { EncryptionService } from "../../src/utils/crypto";
import { InMemorySecretProvider, type SecretProvider } from "../../src/utils/secretManager";
import { env, makeStore, MemoryLimiter, MemoryStorage, secrets, users, verifier } from "../helpers/fakes";

type TestEmailService = {
  verify: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  test: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
};

function app(overrides: Parameters<typeof makeStore>[0] = {}, emailService?: Partial<TestEmailService> | EmailService, secretProvider: SecretProvider = secrets, environment = env, verificationService?: EmailVerificationService) {
  const store = makeStore(overrides);
  const email = (emailService ?? {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn().mockResolvedValue({messageId: "message-1"}), reload: vi.fn()}) as EmailService;
  return createApp({
    env: environment, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets: secretProvider,
    email,
    emailVerification: verificationService ?? new AdvisorEmailVerificationService({createVerificationLink: vi.fn().mockResolvedValue({url: "http://localhost:9099/verify?oobCode=private"})}, email, store),
    gemini: {analyze: vi.fn().mockResolvedValue("analysis")} as never,
    firebaseAccounts: {deleteUser: vi.fn().mockResolvedValue(undefined)}
  });
}

const smtpSettings = {
  SMTP_HOST: "mailpit",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  SMTP_USER: "",
  EMAIL_FROM: "no-reply@syncash.local",
  EMAIL_FROM_NAME: "SynCash",
  EMAIL_REPLY_TO: "support@syncash.local"
};

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
    {order: 1, isPrimary: true, firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15", phone: "0501234567", email: "dana@example.com", address: "רחוב הדוגמה 1", maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6}, income: {monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: null}, liabilities: {monthlyLiabilities: 1_500, existingMortgageBalance: 400_000, existingMortgageMonthlyPayment: 4_000}},
    {order: 2, isPrimary: false, firstName: "נועם", lastName: "לוי", identityNumber: "987654321", dateOfBirth: "1987-08-20", phone: "0501234568", email: "noam@example.com", address: "רחוב הדוגמה 1", maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SELF_EMPLOYED", employerName: "עסק", jobTitle: "בעלים", employmentSeniorityYears: 8}, income: {monthlyNetIncome: 15_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}, liabilities: {monthlyLiabilities: 1_000, existingMortgageBalance: 0, existingMortgageMonthlyPayment: 0}}
  ],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", region: "CENTER", address: "רחוב הנכס 2", value: 2_000_000},
  loanRequest: {dealType: "SECOND_HAND_PURCHASE", requestedAmount: 1_250_000, requestedTermMonths: 240},
  notes: "תיק מלא לבדיקה", status: "ACTIVE"
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
    await request(app()).post("/api/admin/settings/email/test").set("authorization", `Bearer ${token}`).send({recipientEmail: "blocked@example.test"}).expect(403);
  });

  it("allows SUPER_ADMIN to persist SMTP settings and password without returning the password", async () => {
    const setSettings = vi.fn().mockResolvedValue(undefined);
    const addAudit = vi.fn().mockResolvedValue(undefined);
    const localSecrets = new InMemorySecretProvider();
    const response = await request(app({setSettings, addAudit}, undefined, localSecrets)).patch("/api/admin/settings/email")
      .set("authorization", "Bearer super").send({...smtpSettings, smtpPassword: "local-test-password"}).expect(200);
    expect(response.body).toEqual({updated: true, passwordConfigured: true});
    expect(JSON.stringify(response.body)).not.toContain("local-test-password");
    expect(setSettings).toHaveBeenCalledWith("SMTP", smtpSettings, users.super.id);
    expect(await localSecrets.getSecret("syncash-smtp-password")).toBe("local-test-password");
    expect(JSON.stringify(addAudit.mock.calls)).not.toContain("local-test-password");
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
    const email = {send} as unknown as EmailService;
    const verification = new AdvisorEmailVerificationService({createVerificationLink}, email, store);
    const application = createApp({
      env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)), storage: new MemoryStorage(),
      limiter: new MemoryLimiter(), secrets, email, emailVerification: verification,
      gemini: {analyze: vi.fn()} as never, firebaseAccounts: {deleteUser: vi.fn()}
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
    const email = new EmailService(localEnv, new InMemorySecretProvider(), async () => ({...smtpSettings, SMTP_HOST: "127.0.0.1"}));
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
  it("uses Gmail with STARTTLS and never falls back to Mailpit", () => {
    const resolved = resolveSmtpTransportSettings(env, {
      SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "587", SMTP_SECURE: "false",
      SMTP_USER: "advisor@gmail.com"
    }, "not-a-real-password");
    expect(resolved).toEqual(expect.objectContaining({host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true}));
    expect(JSON.stringify(resolved)).not.toContain("mailpit");
  });

  it("returns a clear failure when the SMTP password is missing", async () => {
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const email = {test: vi.fn().mockRejectedValue(new SmtpServiceError("SMTP_PASSWORD_NOT_CONFIGURED")), reload: vi.fn()};
    const response = await request(app({addEmailLog}, email)).post("/api/admin/settings/email/test")
      .set("authorization", "Bearer super").send({recipientEmail: "super@example.test"}).expect(409);
    expect(response.body).toEqual(expect.objectContaining({error: "SMTP_CREDENTIAL_NOT_CONFIGURED", requestId: expect.any(String)}));
    expect(addEmailLog).toHaveBeenCalledWith({recipient: "super@example.test", status: "FAILED", sanitizedError: "SMTP_CREDENTIAL_NOT_CONFIGURED"});
  });

  it("sanitizes invalid Gmail credentials and never reports success", async () => {
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const email = {test: vi.fn().mockRejectedValue(Object.assign(new Error("535 password=private"), {code: "EAUTH", responseCode: 535})), reload: vi.fn()};
    const response = await request(app({addEmailLog}, email)).post("/api/admin/settings/email/test")
      .set("authorization", "Bearer super").send({recipientEmail: "super@example.test"}).expect(502);
    expect(response.body).toEqual(expect.objectContaining({error: "SMTP_AUTH_FAILED", requestId: expect.any(String)}));
    expect(response.body).not.toHaveProperty("messageId");
    expect(JSON.stringify(response.body)).not.toContain("private");
  });

  it("sends through Mailpit and records a successful email log", async () => {
    const recipient = `smtp-test-${Date.now()}@syncash.local`;
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const localEnv = {...env, SMTP_HOST: "127.0.0.1", SMTP_PORT: 1025, SMTP_SECURE: false, SMTP_USER: ""};
    const email = new EmailService(localEnv, new InMemorySecretProvider(), async () => ({
      ...smtpSettings,
      SMTP_HOST: "127.0.0.1"
    }));
    const response = await request(app({addEmailLog}, email, new InMemorySecretProvider(), localEnv)).post("/api/admin/settings/email/test")
      .set("authorization", "Bearer super").send({recipientEmail: recipient}).expect(200);
    expect(response.body.messageId).toEqual(expect.any(String));
    expect(addEmailLog).toHaveBeenCalledWith({recipient, messageId: response.body.messageId, status: "SENT"});
    await expect.poll(async () => {
      const listing = await fetch("http://localhost:8025/api/v1/messages").then((result) => result.json()) as {messages?: Array<{To?: Array<{Address?: string}>}>};
      return listing.messages?.some((message) => message.To?.some((target) => target.Address === recipient)) ?? false;
    }).toBe(true);
  });

  it("never exposes a password through responses or server logs", async () => {
    const password = "smtp-password-must-not-leak";
    const setSecret = vi.fn().mockRejectedValue(new Error(`failed ${password}`));
    const secretProvider: SecretProvider = {getSecret: vi.fn(), isConfigured: vi.fn(), setSecret};
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await request(app({}, undefined, secretProvider)).patch("/api/admin/settings/email")
        .set("authorization", "Bearer super").send({...smtpSettings, smtpPassword: password}).expect(500);
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
      dealType: "SECOND_HAND_PURCHASE", borrowers: expect.arrayContaining([
        expect.objectContaining({hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, monthlyLiabilities: 1_500, existingMortgageBalance: 400_000, existingMortgageMonthlyPayment: 4_000})
      ])
    }));
    expect(createClient.mock.calls[0][0].propertyAddressEncrypted).not.toContain(completeClientInput.property.address);
    expect(response.body).not.toHaveProperty("monthlyGrossIncome");
  });

  it.each([
    ["required field", {borrowers: [{...completeClientInput.borrowers[0], firstName: undefined}, completeClientInput.borrowers[1]]}, "borrowers.0.firstName"],
    ["one age per child", {household: {numberOfChildren: 2, childrenAges: [4]}}, "household.childrenAges"],
    ["additional income type", {borrowers: [{...completeClientInput.borrowers[0], income: {...completeClientInput.borrowers[0].income, additionalIncomeType: null}}, completeClientInput.borrowers[1]]}, "borrowers.0.income.additionalIncomeType"],
    ["positive additional income amount", {borrowers: [{...completeClientInput.borrowers[0], income: {...completeClientInput.borrowers[0].income, additionalIncomeAmount: 0}}, completeClientInput.borrowers[1]]}, "borrowers.0.income.additionalIncomeAmount"],
    ["existing mortgage balance", {borrowers: [{...completeClientInput.borrowers[0], liabilities: {...completeClientInput.borrowers[0].liabilities, existingMortgageBalance: undefined}}, completeClientInput.borrowers[1]]}, "borrowers.0.liabilities.existingMortgageBalance"],
    ["existing mortgage monthly payment", {borrowers: [{...completeClientInput.borrowers[0], liabilities: {...completeClientInput.borrowers[0].liabilities, existingMortgageMonthlyPayment: undefined}}, completeClientInput.borrowers[1]]}, "borrowers.0.liabilities.existingMortgageMonthlyPayment"],
    ["property address", {property: {...completeClientInput.property, address: undefined}}, "property.address"],
    ["valid deal type", {loanRequest: {...completeClientInput.loanRequest, dealType: "PURCHASE"}}, "loanRequest.dealType"]
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

describe("multi-borrower client create and update", () => {
  it("creates every borrower in one nested encrypted record", async () => {
    const existing = await makeStore().getClient(1);
    const createClient = vi.fn().mockResolvedValue(existing);
    const response = await request(app({createClient})).post("/api/clients")
      .set("authorization", "Bearer advisor").send(completeClientInput).expect(201);
    const record = createClient.mock.calls[0][0];
    expect(record).toEqual(expect.objectContaining({numberOfBorrowers: 2, borrowerRelationship: "MARRIED", householdChildrenCount: 2, dealType: "SECOND_HAND_PURCHASE"}));
    expect(record.borrowers).toHaveLength(2);
    expect(record.borrowers[0]).toEqual(expect.objectContaining({borrowerOrder: 1, isPrimary: true, employmentType: "SALARIED", monthlyLiabilities: 1_500}));
    expect(record.borrowers[1]).toEqual(expect.objectContaining({borrowerOrder: 2, isPrimary: false, employmentType: "SELF_EMPLOYED"}));
    expect(record.borrowers[0].identityNumberEncrypted).not.toContain("123456789");
    expect(record.propertyAddressEncrypted).not.toContain(completeClientInput.property.address);
    expect(response.body.borrowers).toHaveLength(2);
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
    ["one borrower", {...completeClientInput, numberOfBorrowers: 1, borrowerRelationship: null, household: {numberOfChildren: 0, childrenAges: []}, borrowers: [{...completeClientInput.borrowers[0], children: {numberOfChildren: 2, childrenAges: [4, 8]}}]}],
    ["common law", {...completeClientInput, borrowerRelationship: "COMMON_LAW"}],
    ["family with separate children", {...completeClientInput, borrowerRelationship: "FAMILY", household: {numberOfChildren: 0, childrenAges: []}, borrowers: completeClientInput.borrowers.map((borrower, index) => ({...borrower, children: {numberOfChildren: 1, childrenAges: [index + 5]}}))}]
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
  it("accepts a real PDF signature", async () => { await request(app()).post("/api/clients/1/documents").set("authorization", "Bearer advisor").attach("file", Buffer.from("%PDF-1.7\ncontent"), {filename: "file.pdf", contentType: "application/pdf"}).expect(201); });
  it("rejects a fake MIME type", async () => { await request(app()).post("/api/clients/1/documents").set("authorization", "Bearer advisor").attach("file", Buffer.from("not a pdf"), {filename: "file.pdf", contentType: "application/pdf"}).expect(400); });
  it("blocks document download by another advisor", async () => { await request(app()).get("/api/documents/1/download").set("authorization", "Bearer advisor2").expect(403); });
});

describe("lender isolation", () => {
  it("requires authentication for replies, offers, and identity requests", async () => {
    await request(app()).post("/api/lender/submissions/1/reply").expect(401);
    await request(app()).post("/api/lender/submissions/1/offers").expect(401);
    await request(app()).post("/api/lender/submissions/1/identity-request").expect(401);
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
  it("accepts an offer from the assigned lender", async () => {
    await request(app()).post("/api/lender/submissions/1/offers").set("authorization", "Bearer lender")
      .send({amount: 1_000_000, interestRate: 6.5, termMonths: 240}).expect(201);
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
  const snapshotSource = {publicCaseNumber: "SC-1", dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyRegion: "CENTER", propertyValue: 2_000_000, requestedAmount: 1_000_000, numberOfBorrowers: 2, borrowerRelationship: "MARRIED", employmentTypes: ["SALARIED", "SELF_EMPLOYED"], borrowerBirthDatesEncrypted: [null, null], borrowerBirthDates: [new Date("1985-06-15"), new Date("1987-08-20")], totalMonthlyIncome: 50_000, totalMonthlyPayments: 6_000, existingMortgageBalance: 400_000, requestedTermMonths: 240};

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
});

import { createHash, randomBytes, randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import multer from "multer";
import { z } from "zod";
import { allowedOrigins, type AppEnv } from "../config/env.js";
import { IDENTITY_FIELDS, type IdentityField } from "../domain/types.js";
import { advisorProfileSchema, advisorRegistrationApiSchema, normalizeEmail } from "../domain/advisorRegistration.js";
import { clientInputSchema, type ClientInput } from "../domain/clientValidation.js";
import { DOCUMENT_TYPES, REQUIRED_BORROWER_DOCUMENT_TYPES } from "../domain/clientFields.js";
import { createAuthMiddleware, type TokenVerifier } from "../middleware/auth.js";
import { createAnonymousPdf } from "../services/pdf.js";
import { rateLimit, type RateLimitStore } from "../services/rateLimiter.js";
import { buildAnonymousSubmissionSnapshot } from "../services/snapshot.js";
import type { AppStore, ClientMutationRecord } from "../services/store.js";
import type { StorageService } from "../services/storage.js";
import { sanitizeEmailError, sanitizeSmtpFailure, type EmailService } from "../services/email.js";
import { ADVISOR_EMAIL_VERIFICATION_TEMPLATE, EmailVerificationDeliveryError, type EmailVerificationService } from "../services/emailVerification.js";
import type { GeminiService } from "../services/gemini.js";
import { EncryptionService, hashToken } from "../utils/crypto.js";
import { calculateAge } from "../utils/age.js";
import type { SecretProvider } from "../utils/secretManager.js";

export interface AppServices {
  env: AppEnv;
  store: AppStore;
  verifier: TokenVerifier;
  encryption: EncryptionService;
  storage: StorageService;
  email: EmailService;
  emailVerification: EmailVerificationService;
  secrets: SecretProvider;
  limiter: RateLimitStore;
  gemini: GeminiService;
  firebaseAccounts: {deleteUser(uid: string): Promise<void>};
}

const asyncRoute = (handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction): void => { void handler(request, response, next).catch(next); };

const smtpSettingsSchema = z.object({
  SMTP_HOST: z.string().trim().min(1).max(253),
  SMTP_PORT: z.string().regex(/^\d+$/).refine((value) => Number(value) >= 1 && Number(value) <= 65_535),
  SMTP_SECURE: z.enum(["true", "false"]),
  SMTP_USER: z.string().trim().max(320),
  EMAIL_FROM: z.string().trim().email().max(320),
  EMAIL_FROM_NAME: z.string().trim().min(1).max(200),
  EMAIL_REPLY_TO: z.string().trim().email().max(320),
  smtpPassword: z.string().max(500).optional()
}).strict();

const advisorStatusSchema = z.object({status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"])}).strict();

function publicAdvisorAccount(account: Awaited<ReturnType<AppStore["getAdvisorAccount"]>>, encryption: EncryptionService) {
  if (!account) return null;
  return {
    id: account.id, email: account.email, firstName: account.firstName, lastName: account.lastName,
    phone: account.phoneEncrypted ? encryption.decrypt(account.phoneEncrypted) : "", role: account.role,
    roleLabel: account.roleLabel, status: account.status, emailVerified: account.emailVerified,
    advisorId: account.advisorId, lenderId: null, businessName: account.businessName ?? "",
    businessEmail: account.businessEmail ?? account.email, createdAt: account.createdAt,
    updatedAt: account.updatedAt, lastLoginAt: account.lastLoginAt
  };
}

function clientMutationRecord(input: ClientInput, encryption: EncryptionService, updatedByUserId: number): ClientMutationRecord {
  const encrypt = (value: string) => encryption.encrypt(value);
  const liabilityRecord = (liability: ClientInput["householdLiabilities"][number]) => ({
    liabilityType: liability.type,
    otherTypeDescriptionEncrypted: liability.otherTypeDescription ? encrypt(liability.otherTypeDescription) : null,
    currentBalance: liability.currentBalance,
    monthlyPayment: liability.monthlyPayment,
    endDate: liability.endDate,
    notesEncrypted: encrypt(liability.notes)
  });
  return {
    dealDetailsEncrypted: encrypt(input.dealDetails),
    dealDetailsUpdatedByUserId: updatedByUserId,
    numberOfBorrowers: input.numberOfBorrowers,
    borrowerRelationship: input.borrowerRelationship,
    borrowerRelationshipOtherEncrypted: input.borrowerRelationshipOther ? encrypt(input.borrowerRelationshipOther) : null,
    householdChildrenCount: input.household.numberOfChildren,
    householdChildrenAges: input.household.childrenAges,
    borrowers: input.borrowers.map((borrower) => ({
      borrowerOrder: borrower.order,
      isPrimary: borrower.isPrimary,
      firstNameEncrypted: encrypt(borrower.firstName),
      lastNameEncrypted: encrypt(borrower.lastName),
      fullNameEncrypted: encrypt(`${borrower.firstName} ${borrower.lastName}`),
      identityNumberEncrypted: encrypt(borrower.identityNumber),
      identityNumberHash: createHash("sha256").update(borrower.identityNumber.replace(/\D/g, "")).digest("hex"),
      birthDateEncrypted: encrypt(borrower.dateOfBirth),
      phoneEncrypted: encrypt(borrower.phone),
      emailEncrypted: encrypt(borrower.email),
      addressEncrypted: encrypt(borrower.address),
      maritalStatus: borrower.maritalStatus,
      numberOfChildren: borrower.children.numberOfChildren,
      childrenAges: borrower.children.childrenAges,
      employmentType: borrower.employment.employmentType,
      employerNameEncrypted: encrypt(borrower.employment.employerName),
      jobTitle: borrower.employment.jobTitle,
      employmentSeniorityYears: borrower.employment.employmentSeniorityYears,
      monthlyNetIncome: borrower.income.monthlyNetIncome,
      hasAdditionalIncome: borrower.income.hasAdditionalIncome,
      additionalIncomeType: borrower.income.additionalIncomeType,
      additionalIncomeAmount: borrower.income.additionalIncomeAmount,
      additionalIncomeDescriptionEncrypted: borrower.income.additionalIncomeDescription ? encrypt(borrower.income.additionalIncomeDescription) : null,
      liabilities: borrower.liabilities.map(liabilityRecord)
    })),
    householdLiabilities: input.householdLiabilities.map(liabilityRecord),
    loanPurpose: input.loanPurpose,
    propertyType: input.property.propertyType,
    propertyTypeOtherDescriptionEncrypted: input.property.propertyTypeOtherDescription ? encrypt(input.property.propertyTypeOtherDescription) : null,
    propertyCity: input.property.city,
    propertyAddressEncrypted: encrypt(input.property.address),
    propertyValue: input.property.value,
    requestedAmount: input.loanRequest.requestedAmount,
    status: "ACTIVE"
  };
}

async function publicClient(client: Awaited<ReturnType<AppStore["getClient"]>>, store: AppStore, encryption: EncryptionService) {
  if (!client) return null;
  const details = await store.getClientDetails(client.id);
  const publicBorrowers = (details?.borrowers ?? []).map((borrower) => {
    const birthDate = borrower.birthDateEncrypted
      ? encryption.decrypt(borrower.birthDateEncrypted)
      : borrower.birthDate?.toISOString().slice(0, 10) ?? "";
    return {
      id: borrower.id,
      borrowerOrder: borrower.borrowerOrder,
      isPrimary: borrower.isPrimary,
      firstName: borrower.firstNameEncrypted ? encryption.decrypt(borrower.firstNameEncrypted) : "",
      lastName: borrower.lastNameEncrypted ? encryption.decrypt(borrower.lastNameEncrypted) : "",
      identityNumber: encryption.decrypt(borrower.identityNumberEncrypted),
      birthDate,
      age: birthDate ? calculateAge(birthDate) : null,
      calculatedAge: birthDate ? calculateAge(birthDate) : null,
      phone: borrower.phoneEncrypted ? encryption.decrypt(borrower.phoneEncrypted) : "",
      email: borrower.emailEncrypted ? encryption.decrypt(borrower.emailEncrypted) : "",
      address: borrower.addressEncrypted ? encryption.decrypt(borrower.addressEncrypted) : "",
      maritalStatus: borrower.maritalStatus ?? "SINGLE",
      children: {numberOfChildren: borrower.numberOfChildren, childrenAges: borrower.childrenAges},
      employment: {
        employmentType: borrower.employmentType,
        employerName: borrower.employerNameEncrypted ? encryption.decrypt(borrower.employerNameEncrypted) : "",
        jobTitle: borrower.jobTitle,
        employmentSeniorityYears: borrower.employmentSeniorityYears
      },
      income: {
        monthlyNetIncome: borrower.monthlyNetIncome,
        hasAdditionalIncome: borrower.hasAdditionalIncome,
        additionalIncomeType: borrower.additionalIncomeType,
        additionalIncomeAmount: borrower.additionalIncomeAmount,
        additionalIncomeDescription: borrower.additionalIncomeDescriptionEncrypted ? encryption.decrypt(borrower.additionalIncomeDescriptionEncrypted) : null
      },
      liabilities: borrower.liabilities.map((liability) => ({
        id: liability.id, scope: liability.scope, type: liability.liabilityType,
        otherTypeDescription: liability.otherTypeDescriptionEncrypted ? encryption.decrypt(liability.otherTypeDescriptionEncrypted) : null,
        currentBalance: liability.currentBalance, monthlyPayment: liability.monthlyPayment, endDate: liability.endDate,
        notes: liability.notesEncrypted ? encryption.decrypt(liability.notesEncrypted) : "",
        incompleteLegacy: liability.legacyStatus === "INCOMPLETE_LEGACY"
      }))
    };
  });
  const primary = publicBorrowers[0];
  const missingRequiredDocuments = await store.listMissingRequiredDocuments(client.id);
  const dealDetailsUpdatedBy = client.dealDetailsUpdatedByUserId ? await store.getUserDisplayName(client.dealDetailsUpdatedByUserId) : null;
  const totalMonthlyIncome = publicBorrowers.reduce((sum, borrower) => sum + borrower.income.monthlyNetIncome + borrower.income.additionalIncomeAmount, 0);
  const householdLiabilities = (details?.householdLiabilities ?? []).map((liability) => ({
    id: liability.id, scope: liability.scope, type: liability.liabilityType,
    otherTypeDescription: liability.otherTypeDescriptionEncrypted ? encryption.decrypt(liability.otherTypeDescriptionEncrypted) : null,
    currentBalance: liability.currentBalance, monthlyPayment: liability.monthlyPayment, endDate: liability.endDate,
    notes: liability.notesEncrypted ? encryption.decrypt(liability.notesEncrypted) : "",
    incompleteLegacy: liability.legacyStatus === "INCOMPLETE_LEGACY"
  }));
  const allLiabilities = [...householdLiabilities, ...publicBorrowers.flatMap((borrower) => borrower.liabilities)];
  const totalMonthlyPayments = allLiabilities.reduce((sum, liability) => sum + liability.monthlyPayment, 0);
  const totalLiabilityBalance = allLiabilities.reduce((sum, liability) => sum + liability.currentBalance, 0);
  return {
    id: client.id,
    publicCaseNumber: client.publicCaseNumber,
    advisorId: client.advisorId,
    status: client.status,
    firstName: primary?.firstName ?? encryption.decrypt(client.firstNameEncrypted),
    lastName: primary?.lastName ?? encryption.decrypt(client.lastNameEncrypted),
    identityNumber: primary?.identityNumber ?? encryption.decrypt(client.identityNumberEncrypted),
    phone: primary?.phone ?? encryption.decrypt(client.phoneEncrypted),
    email: primary?.email ?? encryption.decrypt(client.emailEncrypted),
    address: primary?.address ?? (client.addressEncrypted ? encryption.decrypt(client.addressEncrypted) : ""),
    dealDetails: client.dealDetailsEncrypted ? encryption.decrypt(client.dealDetailsEncrypted) : client.notesEncrypted ? encryption.decrypt(client.notesEncrypted) : "",
    dealDetailsUpdatedAt: client.dealDetailsUpdatedAt,
    dealDetailsUpdatedBy: dealDetailsUpdatedBy ?? "המערכת",
    numberOfBorrowers: client.numberOfBorrowers,
    borrowerRelationship: client.borrowerRelationship,
    borrowerRelationshipOther: client.borrowerRelationshipOtherEncrypted ? encryption.decrypt(client.borrowerRelationshipOtherEncrypted) : null,
    household: {numberOfChildren: client.householdChildrenCount, childrenAges: client.householdChildrenAges},
    borrowers: publicBorrowers,
    householdLiabilities,
    maritalStatus: primary?.maritalStatus ?? client.maritalStatus,
    numberOfChildren: primary?.children.numberOfChildren ?? client.numberOfChildren,
    childrenAges: primary?.children.childrenAges ?? client.childrenAges,
    borrowerCount: client.numberOfBorrowers,
    birthDate: primary?.birthDate ?? "",
    employmentType: primary?.employment.employmentType ?? "",
    employerName: primary?.employment.employerName ?? "",
    jobTitle: primary?.employment.jobTitle ?? "",
    employmentSeniorityYears: primary?.employment.employmentSeniorityYears ?? 0,
    monthlyNetIncome: primary?.income.monthlyNetIncome ?? 0,
    hasAdditionalIncome: primary?.income.hasAdditionalIncome ?? false,
    additionalIncomeType: primary?.income.additionalIncomeType ?? null,
    additionalIncomeAmount: primary?.income.additionalIncomeAmount ?? 0,
    additionalIncomeDescription: primary?.income.additionalIncomeDescription ?? null,
    loanPurpose: details?.loanPurpose ?? "",
    propertyType: details?.propertyType ?? "",
    propertyTypeOtherDescription: details?.propertyTypeOtherDescriptionEncrypted ? encryption.decrypt(details.propertyTypeOtherDescriptionEncrypted) : null,
    propertyCity: details?.propertyCity ?? "",
    propertyAddress: details?.propertyAddressEncrypted ? encryption.decrypt(details.propertyAddressEncrypted) : "",
    propertyValue: details?.propertyValue ?? 0,
    requestedAmount: details?.requestedAmount ?? 0,
    financingPercentage: details?.financingPercentage ?? 0,
    latestSubmissionStatus: details?.latestSubmissionStatus ?? null,
    offerCount: details?.offerCount ?? 0,
    totalMonthlyIncome,
    totalMonthlyPayments,
    totalLiabilityBalance,
    activeLiabilityCount: allLiabilities.length,
    missingRequiredDocuments,
    missingRequiredDocumentCount: missingRequiredDocuments.length,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt
  };
}

function snapshotSourceWithAges(source: NonNullable<Awaited<ReturnType<AppStore["getSnapshotSource"]>>>, encryption: EncryptionService) {
  const borrowerAges = source.borrowerBirthDatesEncrypted.map((encryptedBirthDate, index) => {
    const birthDate = encryptedBirthDate
      ? encryption.decrypt(encryptedBirthDate)
      : source.borrowerBirthDates[index]?.toISOString().slice(0, 10) ?? "";
    return calculateAge(birthDate);
  }).filter((age): age is number => age !== null);
  return {...source, borrowerAges};
}

function publicDocument(document: Awaited<ReturnType<AppStore["getDocument"]>> | NonNullable<Awaited<ReturnType<AppStore["getDocument"]>>>, encryption: EncryptionService) {
  if (!document) return null;
  const {descriptionEncrypted, storageKey: _storageKey, checksumSha256: _checksumSha256, ...safeDocument} = document;
  void _storageKey; void _checksumSha256;
  return {...safeDocument, description: descriptionEncrypted ? encryption.decrypt(descriptionEncrypted) : null};
}

function detectMime(file: Express.Multer.File): string | null {
  const bytes = file.buffer;
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export function createApp(services: AppServices) {
  const app = express();
  const auth = createAuthMiddleware(services.store, services.verifier);
  const authenticated = [auth.requireFirebaseAuth, auth.loadDatabaseUser, auth.requireActiveUser];
  const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: services.env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 1}});

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins(services.env).includes(origin)) callback(null, true);
      else callback(new Error("Origin not allowed"));
    },
    credentials: true
  }));
  app.use((request, response, next) => {
    request.requestId = request.header("x-request-id")?.slice(0, 64) || randomUUID();
    response.setHeader("x-request-id", request.requestId);
    next();
  });
  app.use(express.json({limit: "1mb"}));

  app.get("/api/health", (_request, response) => response.json({status: "ok"}));

  const loginAttemptLimit = services.env.NODE_ENV === "production" ? 10 : 100;
  app.post("/api/auth/login-attempt", rateLimit(services.limiter, "login-attempt", loginAttemptLimit, 15 * 60), (_request, response) => response.json({allowed: true}));

  app.post("/api/auth/register-advisor", auth.requireFirebaseAuth, rateLimit(services.limiter, "advisor-registration", 5, 60 * 60), asyncRoute(async (request, response) => {
    await services.store.addAudit(null, "ADVISOR_REGISTRATION_STARTED", "user", null, {source: "self_service"}, request.requestId, request.ip, request.header("user-agent"));
    const parsed = advisorRegistrationApiSchema.safeParse(request.body);
    if (!parsed.success) {
      await services.store.addAudit(null, "ADVISOR_REGISTRATION_FAILED", "user", null, {reason: "VALIDATION_ERROR"}, request.requestId, request.ip, request.header("user-agent"));
      throw parsed.error;
    }
    const identity = request.firebaseIdentity!;
    const email = normalizeEmail(identity.email ?? "");
    if (!email || email !== parsed.data.email) {
      await services.store.addAudit(null, "ADVISOR_REGISTRATION_FAILED", "user", null, {reason: "EMAIL_MISMATCH"}, request.requestId, request.ip, request.header("user-agent"));
      response.status(400).json({error: "EMAIL_MISMATCH", requestId: request.requestId});
      return;
    }
    if (await services.store.findUserByFirebaseUid(identity.uid) || await services.store.findUserByEmail(email)) {
      await services.store.addAudit(null, "ADVISOR_REGISTRATION_FAILED", "user", null, {reason: "DUPLICATE_ACCOUNT"}, request.requestId, request.ip, request.header("user-agent"));
      response.status(409).json({error: "ADVISOR_ALREADY_REGISTERED", message: "כתובת הדוא״ל כבר רשומה במערכת", requestId: request.requestId});
      return;
    }
    let account: Awaited<ReturnType<AppStore["createAdvisorAccount"]>>;
    try {
      const encryptedPhone = services.encryption.encrypt(parsed.data.phone);
      account = await services.store.createAdvisorAccount({
        firebaseUid: identity.uid, email, firstName: parsed.data.firstName, lastName: parsed.data.lastName,
        phoneEncrypted: encryptedPhone, businessName: parsed.data.businessName,
        businessPhoneEncrypted: encryptedPhone, businessEmail: email
      });
      await services.store.addAudit(account.id, "ADVISOR_REGISTERED", "user", account.id, {source: "self_service"}, request.requestId, request.ip, request.header("user-agent"));
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      await services.store.addAudit(null, "ADVISOR_REGISTRATION_FAILED", "user", null, {reason: code === "23505" ? "DUPLICATE_ACCOUNT" : "DATABASE_ERROR"}, request.requestId, request.ip, request.header("user-agent"));
      if (code === "23505") {
        response.status(409).json({error: "ADVISOR_ALREADY_REGISTERED", message: "כתובת הדוא״ל כבר רשומה במערכת", requestId: request.requestId});
        return;
      }
      throw error;
    }
    try {
      await services.emailVerification.sendVerificationEmail({
        firebaseUid: account.firebaseUid,
        email: account.email,
        displayName: account.firstName
      }, {userId: account.id, requestId: request.requestId});
      await services.store.addAudit(account.id, "EMAIL_VERIFICATION_SENT", "user", account.id, {channel: "smtp", template: ADVISOR_EMAIL_VERIFICATION_TEMPLATE}, request.requestId, request.ip, request.header("user-agent"));
      response.status(201).json({success: true, verificationEmailSent: true});
    } catch (error) {
      const delivery = error instanceof EmailVerificationDeliveryError ? error : new EmailVerificationDeliveryError("VERIFICATION_EMAIL_DELIVERY_FAILED", 502);
      await services.store.addAudit(account.id, "ADVISOR_VERIFICATION_EMAIL_FAILED", "user", account.id, {errorCode: delivery.code}, request.requestId, request.ip, request.header("user-agent"));
      response.status(delivery.status).json({
        error: delivery.code,
        message: "החשבון נוצר, אך לא הצלחנו לשלוח את מייל האימות. ניתן לנסות לשלוח אותו מחדש.",
        accountCreated: true,
        verificationEmailSent: false,
        requestId: request.requestId
      });
    }
  }));

  app.get("/api/auth/me", auth.requireFirebaseAuth, auth.loadDatabaseUser, asyncRoute(async (request, response) => {
    let user = request.user!;
    let activatedAdvisor: Awaited<ReturnType<AppStore["getAdvisorAccount"]>> = null;
    if (user.role === "ADVISOR" && user.status === "PENDING") {
      if (!request.firebaseIdentity!.emailVerified) {
        response.status(403).json({error: "EMAIL_NOT_VERIFIED", message: "כתובת הדוא״ל עדיין לא אומתה", requestId: request.requestId});
        return;
      }
      const activated = await services.store.activateVerifiedAdvisor(user.id);
      if (!activated) { response.status(409).json({error: "ADVISOR_ACTIVATION_FAILED", requestId: request.requestId}); return; }
      await services.store.addAudit(user.id, "EMAIL_VERIFIED", "user", user.id, {source: "firebase_token"}, request.requestId, request.ip, request.header("user-agent"));
      user = activated;
      activatedAdvisor = activated;
    }
    if (user.status !== "ACTIVE" || user.deletedAt !== null) {
      response.status(403).json({error: "USER_INACTIVE", requestId: request.requestId});
      return;
    }
    await services.store.recordLogin(user.id);
    const advisor = user.role === "ADVISOR" ? activatedAdvisor ?? await services.store.getAdvisorAccount(user.id) : null;
    response.json(advisor ? publicAdvisorAccount(advisor, services.encryption) : {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, roleLabel: user.roleLabel, status: user.status, emailVerified: true,
      advisorId: user.advisorId, lenderId: user.lenderId, phone: "", businessName: ""
    });
  }));

  app.post("/api/auth/email-verification/resend", auth.requireFirebaseAuth, auth.loadDatabaseUser,
    rateLimit(services.limiter, "verification-resend-minute", 1, 60), rateLimit(services.limiter, "verification-resend-hour", 5, 60 * 60),
    asyncRoute(async (request, response) => {
      const user = request.user!;
      if (user.role !== "ADVISOR" || user.status !== "PENDING" || user.emailVerified || request.firebaseIdentity!.emailVerified) {
        response.status(409).json({error: "VERIFICATION_NOT_REQUIRED", requestId: request.requestId}); return;
      }
      try {
        await services.emailVerification.sendVerificationEmail({firebaseUid: user.firebaseUid, email: user.email, displayName: user.firstName}, {userId: user.id, requestId: request.requestId});
        await services.store.addAudit(user.id, "EMAIL_VERIFICATION_SENT", "user", user.id, {channel: "smtp", template: ADVISOR_EMAIL_VERIFICATION_TEMPLATE}, request.requestId, request.ip, request.header("user-agent"));
        response.json({success: true, verificationEmailSent: true, lastSentAt: new Date().toISOString()});
      } catch (error) {
        const delivery = error instanceof EmailVerificationDeliveryError ? error : new EmailVerificationDeliveryError("VERIFICATION_EMAIL_DELIVERY_FAILED", 502);
        await services.store.addAudit(user.id, "ADVISOR_VERIFICATION_EMAIL_FAILED", "user", user.id, {errorCode: delivery.code}, request.requestId, request.ip, request.header("user-agent"));
        response.status(delivery.status).json({error: delivery.code, message: "שליחת מייל האימות נכשלה.", verificationEmailSent: false, requestId: request.requestId});
      }
    }));

  app.get("/api/auth/email-verification/status", auth.requireFirebaseAuth, auth.loadDatabaseUser, asyncRoute(async (request, response) => {
    const user = request.user!;
    if (user.role !== "ADVISOR") { response.status(403).json({error: "FORBIDDEN", requestId: request.requestId}); return; }
    const latest = await services.store.getLatestEmailLog(user.id, ADVISOR_EMAIL_VERIFICATION_TEMPLATE);
    response.json({
      email: user.email,
      emailVerified: user.emailVerified || request.firebaseIdentity!.emailVerified,
      status: latest?.status ?? "NOT_SENT",
      lastSentAt: latest?.sentAt?.toISOString() ?? latest?.failedAt?.toISOString() ?? null
    });
  }));

  app.get("/api/clients", ...authenticated, auth.requireRole("ADVISOR", "SUPER_ADMIN"), asyncRoute(async (request, response) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize) || 20));
    const search = String(request.query.search ?? "").slice(0, 100);
    const advisorId = request.user!.role === "ADVISOR" ? request.user!.advisorId : null;
    const result = await services.store.listClients(advisorId, page, pageSize, search);
    response.json({items: await Promise.all(result.items.map((client) => publicClient(client, services.store, services.encryption))), total: result.total, page, pageSize});
  }));

  app.post("/api/clients", ...authenticated, auth.requireRole("ADVISOR"), asyncRoute(async (request, response) => {
    const input = clientInputSchema.parse(request.body);
    const advisorId = request.user!.advisorId;
    if (!advisorId) { response.status(403).json({error: "ADVISOR_PROFILE_REQUIRED"}); return; }
    const publicCaseNumber = `SC-${randomBytes(8).toString("hex").toUpperCase()}`;
    const client = await services.store.createClient({
      publicCaseNumber, advisorId, ...clientMutationRecord(input, services.encryption, request.user!.id)
    });
    await services.store.addAudit(request.user!.id, "CLIENT_CREATED", "client", client.id, {publicCaseNumber}, request.requestId, request.ip, request.header("user-agent"));
    response.status(201).json(await publicClient(client, services.store, services.encryption));
  }));

  app.get("/api/clients/:id", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    const client = await services.store.getClient(request.authorizedClientId!);
    response.json(await publicClient(client, services.store, services.encryption));
  }));

  app.patch("/api/clients/:id", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    const input = clientInputSchema.parse(request.body);
    const client = await services.store.updateClient(request.authorizedClientId!, clientMutationRecord(input, services.encryption, request.user!.id));
    await services.store.addAudit(request.user!.id, "CLIENT_UPDATED", "client", request.authorizedClientId!, {fields: Object.keys(input)}, request.requestId);
    response.json(await publicClient(client, services.store, services.encryption));
  }));

  app.delete("/api/clients/:id", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    await services.store.softDeleteClient(request.authorizedClientId!);
    await services.store.addAudit(request.user!.id, "CLIENT_DELETED", "client", request.authorizedClientId!, null, request.requestId);
    response.status(204).end();
  }));

  app.get("/api/clients/:clientId/documents", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    const documentRows = await services.store.listDocuments(request.authorizedClientId!);
    response.json(documentRows.map((document) => publicDocument(document, services.encryption)));
  }));

  app.get("/api/clients/:clientId/documents/requirements", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    response.json({missingDocuments: await services.store.listMissingRequiredDocuments(request.authorizedClientId!)});
  }));

  app.post("/api/clients/:clientId/documents", ...authenticated, auth.requireAdvisorClientAccess, upload.single("file"), asyncRoute(async (request, response) => {
    if (!request.file) { response.status(400).json({error: "FILE_REQUIRED"}); return; }
    const detectedMime = detectMime(request.file);
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!detectedMime || !allowed.includes(request.file.mimetype) || detectedMime !== request.file.mimetype) {
      response.status(400).json({error: "INVALID_FILE_TYPE"}); return;
    }
    const documentInput = z.object({
      documentType: z.enum(DOCUMENT_TYPES, {error: "יש לבחור סוג מסמך"}),
      borrowerId: z.preprocess((value) => value === "" || value === undefined ? null : value, z.coerce.number().int().positive().nullable()),
      customTitle: z.preprocess((value) => value === undefined ? null : value, z.string().trim().max(255).nullable()),
      description: z.preprocess((value) => value === undefined ? null : value, z.string().trim().max(1000).nullable())
    }).strict().parse(request.body);
    const borrowerRequired = REQUIRED_BORROWER_DOCUMENT_TYPES.includes(documentInput.documentType as typeof REQUIRED_BORROWER_DOCUMENT_TYPES[number]);
    if (borrowerRequired && !documentInput.borrowerId) { response.status(400).json({error: "BORROWER_REQUIRED", message: "יש לבחור לווה למסמך הזיהוי"}); return; }
    if (!borrowerRequired && documentInput.documentType !== "OTHER" && documentInput.borrowerId) { response.status(400).json({error: "BORROWER_NOT_ALLOWED"}); return; }
    if (documentInput.documentType === "OTHER" && !documentInput.customTitle) { response.status(400).json({error: "CUSTOM_TITLE_REQUIRED", message: "יש להזין שם או נושא למסמך"}); return; }
    if (documentInput.borrowerId) {
      const details = await services.store.getClientDetails(request.authorizedClientId!);
      if (!details?.borrowers.some((borrower) => borrower.id === documentInput.borrowerId)) { response.status(400).json({error: "INVALID_BORROWER"}); return; }
    }
    const storageKey = `clients/${request.authorizedClientId}/${randomUUID()}`;
    const checksumSha256 = createHash("sha256").update(request.file.buffer).digest("hex");
    await services.storage.put(storageKey, request.file.buffer, detectedMime, {checksum: checksumSha256});
    const document = await services.store.createDocument({
      clientId: request.authorizedClientId!, uploadedByUserId: request.user!.id,
      borrowerId: documentInput.borrowerId, documentType: documentInput.documentType,
      customTitle: documentInput.customTitle,
      descriptionEncrypted: documentInput.description ? services.encryption.encrypt(documentInput.description) : null,
      originalFileName: request.file.originalname.slice(0, 255), storageKey, mimeType: detectedMime,
      sizeBytes: request.file.size, checksumSha256
    });
    await services.store.addAudit(request.user!.id, "DOCUMENT_UPLOADED", "document", document.id, {clientId: document.clientId, checksumSha256}, request.requestId);
    response.status(201).json(publicDocument(document, services.encryption));
  }));

  app.get("/api/documents/:documentId/download", ...authenticated, rateLimit(services.limiter, "document-download", 60, 60), asyncRoute(async (request, response) => {
    const document = await services.store.getDocument(Number(request.params.documentId));
    if (!document || document.deletedAt) { response.status(404).json({error: "DOCUMENT_NOT_FOUND"}); return; }
    const advisorId = await services.store.getClientAdvisorId(document.clientId);
    const authorized = request.user!.role === "SUPER_ADMIN" || (request.user!.role === "ADVISOR" && request.user!.advisorId === advisorId);
    if (!authorized) { response.status(403).json({error: "FORBIDDEN"}); return; }
    const object = await services.storage.get(document.storageKey);
    await services.store.addAudit(request.user!.id, "DOCUMENT_DOWNLOADED", "document", document.id, {clientId: document.clientId}, request.requestId);
    response.type(object.contentType).setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`).send(object.body);
  }));

  app.delete("/api/documents/:documentId", ...authenticated, asyncRoute(async (request, response) => {
    const document = await services.store.getDocument(Number(request.params.documentId));
    if (!document) { response.status(404).json({error: "DOCUMENT_NOT_FOUND"}); return; }
    const advisorId = await services.store.getClientAdvisorId(document.clientId);
    if (request.user!.role !== "SUPER_ADMIN" && request.user!.advisorId !== advisorId) { response.status(403).json({error: "FORBIDDEN"}); return; }
    await services.store.softDeleteDocument(document.id);
    await services.store.addAudit(request.user!.id, "DOCUMENT_DELETED", "document", document.id, {clientId: document.clientId}, request.requestId);
    response.status(204).end();
  }));

  app.get("/api/lenders", ...authenticated, auth.requireRole("ADVISOR", "SUPER_ADMIN"), asyncRoute(async (_request, response) => {
    response.json(await services.store.listLenders());
  }));

  app.get("/api/clients/:clientId/submissions", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    response.json(await services.store.listClientSubmissions(request.authorizedClientId!));
  }));

  app.post("/api/clients/:clientId/submissions", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    const input = z.object({lenderIds: z.array(z.number().int().positive()).min(1).max(20)}).parse(request.body);
    if (await services.store.hasIncompleteLegacyLiabilities(request.authorizedClientId!)) {
      response.status(422).json({
        error: "INCOMPLETE_LEGACY_LIABILITIES",
        code: "INCOMPLETE_LEGACY_LIABILITIES",
        message: "נדרש להשלים את פרטי ההתחייבויות שהועברו מהמערכת הישנה לפני שליחת התיק.",
        requestId: request.requestId
      });
      return;
    }
    const missingDocuments = await services.store.listMissingRequiredDocuments(request.authorizedClientId!);
    if (missingDocuments.length > 0) {
      response.status(422).json({error: "MISSING_REQUIRED_DOCUMENTS", code: "MISSING_REQUIRED_DOCUMENTS", missingDocuments, requestId: request.requestId});
      return;
    }
    const available = new Map((await services.store.listLenders()).map((lender) => [lender.id, lender]));
    const source = await services.store.getSnapshotSource(request.authorizedClientId!);
    if (!source) { response.status(409).json({error: "CLIENT_FINANCIAL_DATA_INCOMPLETE"}); return; }
    const snapshot = buildAnonymousSubmissionSnapshot(snapshotSourceWithAges(source, services.encryption));
    const pdf = await createAnonymousPdf(snapshot);
    const results: Array<{lenderId: number; status: string}> = [];
    for (const lenderId of input.lenderIds) {
      const lender = available.get(lenderId);
      if (!lender) { results.push({lenderId, status: "INVALID_LENDER"}); continue; }
      const token = randomBytes(32).toString("base64url");
      const pdfStorageKey = `submissions/${randomUUID()}/anonymous.pdf`;
      await services.storage.put(pdfStorageKey, pdf, "application/pdf");
      const submission = await services.store.createSubmission({
        clientId: request.authorizedClientId!, lenderId, createdByUserId: request.user!.id, snapshot, pdfStorageKey,
        tokenHash: hashToken(token), expiresAt: new Date(Date.now() + services.env.LENDER_INVITE_EXPIRY_HOURS * 3_600_000)
      });
      try {
        const link = `${services.env.APP_URL}/lender/invite/${encodeURIComponent(token)}`;
        const email = await services.email.send(lender.contactEmail, `SynCash financing case ${snapshot.publicCaseNumber}`, `<p>A new anonymous financing case is available.</p><p><a href="${link}">Open secure invitation</a></p>`);
        await services.store.markSubmissionSent(submission.id, email.messageId, lender.contactEmail);
        await services.store.addAudit(request.user!.id, "SUBMISSION_EMAIL_SENT", "submission", submission.id, {lenderId}, request.requestId);
        results.push({lenderId, status: "SENT"});
      } catch {
        await services.store.markSubmissionDeliveryFailed(submission.id, lender.contactEmail, sanitizeEmailError());
        await services.store.addAudit(request.user!.id, "SUBMISSION_DELIVERY_FAILED", "submission", submission.id, {lenderId}, request.requestId);
        results.push({lenderId, status: "DELIVERY_FAILED"});
      }
    }
    response.status(201).json({results});
  }));

  app.post("/api/submissions/:id/retry-delivery", ...authenticated, auth.requireRole("ADVISOR"), rateLimit(services.limiter, "submission-retry", 10, 60), asyncRoute(async (request, response) => {
    const advisorId = request.user!.advisorId;
    if (!advisorId) { response.status(403).json({error: "ADVISOR_PROFILE_REQUIRED"}); return; }
    const token = randomBytes(32).toString("base64url");
    const submissionId = Number(request.params.id);
    const delivery = await services.store.prepareSubmissionRetry(
      submissionId,
      advisorId,
      hashToken(token),
      new Date(Date.now() + services.env.LENDER_INVITE_EXPIRY_HOURS * 3_600_000)
    );
    if (!delivery) { response.status(404).json({error: "SUBMISSION_NOT_FOUND"}); return; }
    try {
      const link = `${services.env.APP_URL}/lender/invite/${encodeURIComponent(token)}`;
      const email = await services.email.send(delivery.recipient, `SynCash financing case ${delivery.publicCaseNumber}`, `<p>The financing invitation was reissued.</p><p><a href="${link}">Open secure invitation</a></p>`);
      await services.store.markSubmissionSent(submissionId, email.messageId, delivery.recipient);
      await services.store.addAudit(request.user!.id, "SUBMISSION_EMAIL_SENT", "submission", submissionId, {retry: true}, request.requestId);
      response.json({status: "SENT"});
    } catch {
      await services.store.markSubmissionDeliveryFailed(submissionId, delivery.recipient, sanitizeEmailError());
      await services.store.addAudit(request.user!.id, "SUBMISSION_DELIVERY_FAILED", "submission", submissionId, {retry: true}, request.requestId);
      response.status(502).json({status: "DELIVERY_FAILED"});
    }
  }));

  app.post("/api/lender/invites/validate", rateLimit(services.limiter, "invite-validation", 20, 60), asyncRoute(async (request, response) => {
    const {token} = z.object({token: z.string().min(20).max(200)}).parse(request.body);
    const invite = await services.store.validateInvite(hashToken(token));
    if (!invite) { response.status(404).json({error: "INVITE_NOT_FOUND"}); return; }
    if (invite.expiresAt.getTime() <= Date.now()) { response.status(410).json({error: "INVITE_EXPIRED"}); return; }
    if (invite.revokedAt) { response.status(403).json({error: "INVITE_REVOKED"}); return; }
    if (invite.usedAt) { response.status(403).json({error: "INVITE_USED"}); return; }
    response.json({lenderName: invite.lenderName, requiresAuthentication: true});
  }));

  app.post("/api/lender/invites/consume", ...authenticated, rateLimit(services.limiter, "invite-consume", 10, 60), asyncRoute(async (request, response) => {
    const {token} = z.object({token: z.string().min(20).max(200)}).parse(request.body);
    const invite = await services.store.validateInvite(hashToken(token));
    if (!invite) { response.status(404).json({error: "INVITE_NOT_FOUND"}); return; }
    if (invite.expiresAt.getTime() <= Date.now()) { response.status(410).json({error: "INVITE_EXPIRED"}); return; }
    if (invite.revokedAt || invite.usedAt) { response.status(403).json({error: "INVITE_UNAVAILABLE"}); return; }
    if (request.user!.lenderId !== invite.lenderId) { response.status(403).json({error: "FORBIDDEN"}); return; }
    await services.store.consumeInvite(invite.tokenId, request.user!.id);
    await services.store.addAudit(request.user!.id, "INVITE_OPENED", "submission", invite.submissionId, null, request.requestId);
    response.json({submissionId: invite.submissionId});
  }));

  app.get("/api/lender/submissions/:id", ...authenticated, auth.requireLenderSubmissionAccess, asyncRoute(async (request, response) => {
    response.json({id: request.authorizedSubmission!.id, status: (await services.store.getLenderSubmission(request.authorizedSubmission!.id))?.status, anonymousSnapshot: request.authorizedSubmission!.anonymousSnapshot});
  }));

  app.get("/api/lender/submissions", ...authenticated, auth.requireRole("LENDER_ADMIN", "LENDER_UNDERWRITER"), asyncRoute(async (request, response) => {
    response.json(await services.store.listLenderSubmissions(request.user!.lenderId!));
  }));

  app.post("/api/lender/submissions/:id/reply", ...authenticated, auth.requireLenderSubmissionAccess, rateLimit(services.limiter, "lender-reply", 30, 60), asyncRoute(async (request, response) => {
    const input = z.object({responseType: z.enum(["MESSAGE", "MORE_INFO_REQUEST", "INTERESTED", "DECLINED"]), message: z.string().trim().min(1).max(4000)}).parse(request.body);
    const reply = await services.store.createLenderResponse(request.authorizedSubmission!.id, request.user!.id, input.responseType, input.message);
    await services.store.addAudit(request.user!.id, "LENDER_REPLY_CREATED", "lender_response", reply.id, {submissionId: request.authorizedSubmission!.id}, request.requestId);
    response.status(201).json(reply);
  }));

  app.post("/api/lender/submissions/:id/identity-request", ...authenticated, auth.requireLenderSubmissionAccess, rateLimit(services.limiter, "identity-request", 10, 60), asyncRoute(async (request, response) => {
    const input = z.object({reason: z.string().trim().min(10).max(1000), requestedFields: z.array(z.enum(IDENTITY_FIELDS)).min(1)}).parse(request.body);
    const identityRequest = await services.store.createIdentityRequest(request.authorizedSubmission!.id, request.user!.id, input.reason, input.requestedFields);
    await services.store.notifyAdvisor(request.authorizedSubmission!.clientId, "IDENTITY_REQUEST", "בקשת חשיפת זהות חדשה", `בקשה ${identityRequest.id} ממתינה להחלטה`);
    await services.store.addAudit(request.user!.id, "IDENTITY_REQUESTED", "identity_request", identityRequest.id, {requestedFields: input.requestedFields}, request.requestId);
    response.status(201).json(identityRequest);
  }));

  app.get("/api/advisor/identity-requests", ...authenticated, auth.requireRole("ADVISOR"), asyncRoute(async (request, response) => {
    response.json(await services.store.listAdvisorIdentityRequests(request.user!.advisorId!));
  }));

  const decideIdentity = (approve: boolean) => asyncRoute(async (request, response) => {
    const input = z.object({approvedFields: z.array(z.enum(IDENTITY_FIELDS)).default([]), approvedDocumentIds: z.array(z.number().int().positive()).default([])}).parse(request.body);
    const decided = await services.store.decideIdentityRequest(Number(request.params.id), request.user!.advisorId!, request.user!.id, input.approvedFields, input.approvedDocumentIds, approve);
    if (!decided) { response.status(404).json({error: "IDENTITY_REQUEST_NOT_FOUND"}); return; }
    const action = approve ? "IDENTITY_APPROVED" : "IDENTITY_REJECTED";
    await services.store.addAudit(request.user!.id, action, "identity_request", Number(request.params.id), {approvedFields: input.approvedFields, approvedDocumentIds: input.approvedDocumentIds}, request.requestId);
    response.json({status: approve ? "APPROVED" : "REJECTED"});
  });
  app.post("/api/advisor/identity-requests/:id/approve", ...authenticated, auth.requireRole("ADVISOR"), decideIdentity(true));
  app.post("/api/advisor/identity-requests/:id/reject", ...authenticated, auth.requireRole("ADVISOR"), decideIdentity(false));

  app.get("/api/lender/submissions/:id/revealed-data", ...authenticated, auth.requireLenderSubmissionAccess, asyncRoute(async (request, response) => {
    const approval = await services.store.getRevealedData(request.authorizedSubmission!.id);
    if (!approval) { response.status(403).json({error: "IDENTITY_NOT_APPROVED"}); return; }
    const data = await services.store.getIdentityData(approval.clientId);
    if (!data) { response.status(404).json({error: "CLIENT_NOT_FOUND"}); return; }
    const fields = new Set<IdentityField>(approval.approvedFields);
    const revealed: Record<string, string> = {};
    if (fields.has("FULL_NAME")) revealed.fullName = `${services.encryption.decrypt(data.firstNameEncrypted)} ${services.encryption.decrypt(data.lastNameEncrypted)}`;
    if (fields.has("PHONE")) revealed.phone = services.encryption.decrypt(data.phoneEncrypted);
    if (fields.has("EMAIL")) revealed.email = services.encryption.decrypt(data.emailEncrypted);
    if (fields.has("IDENTITY_NUMBER")) revealed.identityNumber = services.encryption.decrypt(data.identityNumberEncrypted);
    if (fields.has("PROPERTY_ADDRESS") && data.propertyAddressEncrypted) revealed.propertyAddress = services.encryption.decrypt(data.propertyAddressEncrypted);
    if (fields.has("EMPLOYER") && data.employerNameEncrypted) revealed.employer = services.encryption.decrypt(data.employerNameEncrypted);
    response.json({approvedFields: approval.approvedFields, approvedDocumentIds: approval.approvedDocumentIds, data: revealed});
  }));

  app.get("/api/lender/submissions/:id/documents/:documentId/download", ...authenticated, auth.requireLenderSubmissionAccess, rateLimit(services.limiter, "lender-document-download", 30, 60), asyncRoute(async (request, response) => {
    const approval = await services.store.getRevealedData(request.authorizedSubmission!.id);
    const documentId = Number(request.params.documentId);
    if (!approval?.approvedFields.includes("SPECIFIC_DOCUMENTS") || !approval.approvedDocumentIds.includes(documentId)) {
      response.status(403).json({error: "DOCUMENT_NOT_APPROVED"}); return;
    }
    const document = await services.store.getDocument(documentId);
    if (!document || document.clientId !== request.authorizedSubmission!.clientId || document.deletedAt) { response.status(404).json({error: "DOCUMENT_NOT_FOUND"}); return; }
    const object = await services.storage.get(document.storageKey);
    await services.store.addAudit(request.user!.id, "DOCUMENT_DOWNLOADED", "document", document.id, {submissionId: request.authorizedSubmission!.id}, request.requestId);
    response.type(object.contentType).send(object.body);
  }));

  app.post("/api/lender/submissions/:id/offers", ...authenticated, auth.requireLenderSubmissionAccess, rateLimit(services.limiter, "offer", 20, 60), asyncRoute(async (request, response) => {
    const input = z.object({amount: z.coerce.number().positive(), interestRate: z.coerce.number().positive().max(100), termMonths: z.coerce.number().int().min(12).max(600), monthlyPayment: z.coerce.number().positive().optional(), conditions: z.string().max(4000).optional(), expiresAt: z.coerce.date().optional()}).parse(request.body);
    const offer = await services.store.createOffer({submissionId: request.authorizedSubmission!.id, userId: request.user!.id, ...input});
    await services.store.notifyAdvisor(request.authorizedSubmission!.clientId, "OFFER", "הצעת מימון חדשה", `הצעה ${offer.id} התקבלה`);
    await services.store.addAudit(request.user!.id, "OFFER_CREATED", "offer", offer.id, {submissionId: request.authorizedSubmission!.id}, request.requestId);
    response.status(201).json(offer);
  }));

  const authorizeOffer = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const submissionId = await services.store.getOfferSubmissionId(Number(request.params.id));
    if (!submissionId) { response.status(404).json({error: "OFFER_NOT_FOUND"}); return; }
    request.params.submissionId = String(submissionId);
    await auth.requireLenderSubmissionAccess(request, response, next);
  };
  app.patch("/api/lender/offers/:id", ...authenticated, authorizeOffer, asyncRoute(async (request, response) => {
    const input = z.object({amount: z.coerce.number().positive().optional(), interestRate: z.coerce.number().positive().max(100).optional(), termMonths: z.coerce.number().int().min(12).max(600).optional(), conditions: z.string().max(4000).optional()}).parse(request.body);
    const updated = await services.store.updateOffer(Number(request.params.id), request.authorizedSubmission!.id, input);
    if (!updated) { response.status(404).json({error: "OFFER_NOT_FOUND"}); return; }
    await services.store.addAudit(request.user!.id, "OFFER_UPDATED", "offer", Number(request.params.id), null, request.requestId);
    response.json({status: "UPDATED"});
  }));
  app.post("/api/lender/offers/:id/withdraw", ...authenticated, authorizeOffer, asyncRoute(async (request, response) => {
    const withdrawn = await services.store.withdrawOffer(Number(request.params.id), request.authorizedSubmission!.id);
    if (!withdrawn) { response.status(404).json({error: "OFFER_NOT_FOUND"}); return; }
    await services.store.addAudit(request.user!.id, "OFFER_WITHDRAWN", "offer", Number(request.params.id), null, request.requestId);
    response.json({status: "WITHDRAWN"});
  }));

  app.get("/api/clients/:clientId/offers", ...authenticated, auth.requireAdvisorClientAccess, asyncRoute(async (request, response) => {
    response.json(await services.store.listClientOffers(request.authorizedClientId!));
  }));

  app.get("/api/admin/settings/email", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (_request, response) => {
    const settings = Object.fromEntries((await services.store.getSettings("SMTP")).map((setting) => [setting.key, setting.value]));
    response.json({
      SMTP_HOST: settings.SMTP_HOST ?? services.env.SMTP_HOST,
      SMTP_PORT: settings.SMTP_PORT ?? String(services.env.SMTP_PORT),
      SMTP_SECURE: settings.SMTP_SECURE ?? String(services.env.SMTP_SECURE),
      SMTP_USER: settings.SMTP_USER ?? services.env.SMTP_USER,
      EMAIL_FROM: settings.EMAIL_FROM ?? services.env.EMAIL_FROM,
      EMAIL_FROM_NAME: settings.EMAIL_FROM_NAME ?? services.env.EMAIL_FROM_NAME,
      EMAIL_REPLY_TO: settings.EMAIL_REPLY_TO ?? services.env.EMAIL_REPLY_TO,
      passwordConfigured: await services.secrets.isConfigured("syncash-smtp-password")
    });
  }));
  app.patch("/api/admin/settings/email", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (request, response) => {
    const input = smtpSettingsSchema.parse(request.body);
    const {smtpPassword: password, ...safeSettings} = input;
    if (password) {
      if (!services.secrets.setSecret) { response.status(409).json({error: "SECRET_PROVIDER_READ_ONLY", requestId: request.requestId}); return; }
      await services.secrets.setSecret("syncash-smtp-password", password);
    }
    await services.store.setSettings("SMTP", safeSettings, request.user!.id);
    await services.email.reload();
    await services.store.addAudit(request.user!.id, "SMTP_UPDATED", "system_settings", null, {fields: Object.keys(safeSettings), passwordUpdated: Boolean(password)}, request.requestId);
    response.json({updated: true, passwordConfigured: await services.secrets.isConfigured("syncash-smtp-password")});
  }));
  app.post("/api/admin/settings/email/test", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (request, response) => {
    const recipient = z.object({recipientEmail: z.string().email().optional()}).parse(request.body).recipientEmail ?? request.user!.email;
    try {
      const result = await services.email.test(recipient);
      await services.store.addEmailLog({recipient, messageId: result.messageId, status: "SENT"});
      await services.store.addAudit(request.user!.id, "SMTP_TESTED", "system_settings", null, {recipient, status: "SENT"}, request.requestId);
      response.json({messageId: result.messageId});
    } catch (error: unknown) {
      const failure = sanitizeSmtpFailure(error);
      await services.store.addEmailLog({recipient, status: "FAILED", sanitizedError: failure.code});
      await services.store.addAudit(request.user!.id, "SMTP_TESTED", "system_settings", null, {recipient, status: "FAILED", errorCode: failure.code}, request.requestId);
      response.status(failure.status).json({error: failure.code, message: failure.message, requestId: request.requestId});
    }
  }));

  app.get("/api/admin/advisors", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (_request, response) => {
    const advisors = await services.store.listAdvisorAccounts();
    response.json(advisors.map((advisor) => publicAdvisorAccount(advisor, services.encryption)));
  }));

  app.patch("/api/admin/advisors/:id/status", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (request, response) => {
    const {status} = advisorStatusSchema.parse(request.body);
    const advisor = await services.store.getAdvisorAccount(Number(request.params.id));
    if (!advisor) { response.status(404).json({error: "ADVISOR_NOT_FOUND", requestId: request.requestId}); return; }
    if (status === "ACTIVE" && !advisor.emailVerified) { response.status(409).json({error: "EMAIL_NOT_VERIFIED", requestId: request.requestId}); return; }
    const updated = await services.store.updateAdvisorStatus(advisor.id, status);
    await services.store.addAudit(request.user!.id, `ADVISOR_${status}`, "user", advisor.id, {previousStatus: advisor.status}, request.requestId, request.ip, request.header("user-agent"));
    response.json(publicAdvisorAccount(updated, services.encryption));
  }));

  app.post("/api/admin/advisors/:id/resend-verification", ...authenticated, auth.requireSuperAdmin,
    rateLimit(services.limiter, "admin-verification-resend", 5, 60 * 60), asyncRoute(async (request, response) => {
      const advisor = await services.store.getAdvisorAccount(Number(request.params.id));
      if (!advisor) { response.status(404).json({error: "ADVISOR_NOT_FOUND", requestId: request.requestId}); return; }
      if (advisor.status !== "PENDING" || advisor.emailVerified) { response.status(409).json({error: "VERIFICATION_NOT_REQUIRED", requestId: request.requestId}); return; }
      await services.emailVerification.sendVerificationEmail({firebaseUid: advisor.firebaseUid, email: advisor.email, displayName: advisor.firstName}, {userId: advisor.id, requestId: request.requestId});
      await services.store.addAudit(request.user!.id, "EMAIL_VERIFICATION_SENT", "user", advisor.id, {channel: "smtp", template: ADVISOR_EMAIL_VERIFICATION_TEMPLATE, adminTriggered: true}, request.requestId, request.ip, request.header("user-agent"));
      response.json({success: true, verificationEmailSent: true});
    }));

  app.patch("/api/advisor/profile", ...authenticated, auth.requireRole("ADVISOR"), asyncRoute(async (request, response) => {
    const input = advisorProfileSchema.parse(request.body);
    const encryptedPhone = services.encryption.encrypt(input.phone);
    const advisor = await services.store.updateAdvisorProfile(request.user!.id, {
      firstName: input.firstName, lastName: input.lastName, phoneEncrypted: encryptedPhone,
      businessName: input.businessName, businessPhoneEncrypted: encryptedPhone
    });
    if (!advisor) { response.status(404).json({error: "ADVISOR_NOT_FOUND", requestId: request.requestId}); return; }
    await services.store.addAudit(request.user!.id, "ADVISOR_PROFILE_UPDATED", "user", request.user!.id, {fields: ["firstName", "lastName", "phone", "businessName"]}, request.requestId, request.ip, request.header("user-agent"));
    response.json(publicAdvisorAccount(advisor, services.encryption));
  }));

  if (services.env.NODE_ENV !== "production") {
    app.get("/api/test/email-logs", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (request, response) => {
      const recipient = z.string().email().parse(request.query.recipient);
      response.json(await services.store.listEmailLogs(recipient));
    }));
    app.delete("/api/test/advisors/:id", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (request, response) => {
      const advisor = await services.store.getAdvisorAccount(Number(request.params.id));
      if (!advisor || !advisor.email.endsWith("@syncash-e2e.local")) { response.status(404).json({error: "TEST_ADVISOR_NOT_FOUND", requestId: request.requestId}); return; }
      await services.store.softDeleteAdvisorAccount(advisor.id);
      await services.firebaseAccounts.deleteUser(advisor.firebaseUid).catch(() => undefined);
      await services.store.addAudit(request.user!.id, "TEST_ADVISOR_CLEANED", "user", advisor.id, {scope: "e2e"}, request.requestId, request.ip, request.header("user-agent"));
      response.status(204).send();
    }));
  }

  app.get("/api/admin/audit-logs", ...authenticated, auth.requireSuperAdmin, asyncRoute(async (request, response) => {
    response.json(await services.store.listAuditLogs(Number(request.query.limit) || 100));
  }));

  app.post("/api/admin/security/encryption-test", ...authenticated, auth.requireSuperAdmin, (request, response) => {
    const source = randomUUID();
    const encrypted = services.encryption.encrypt(source);
    response.json({configured: services.encryption.decrypt(encrypted) === source});
  });

  app.get("/api/notifications", ...authenticated, asyncRoute(async (request, response) => {
    response.json(await services.store.listNotifications(request.user!.id));
  }));
  app.patch("/api/notifications/:id/read", ...authenticated, asyncRoute(async (request, response) => {
    const updated = await services.store.markNotificationRead(Number(request.params.id), request.user!.id);
    if (!updated) { response.status(404).json({error: "NOTIFICATION_NOT_FOUND"}); return; }
    response.json({read: true});
  }));

  app.post("/api/clients/:clientId/analysis", ...authenticated, auth.requireAdvisorClientAccess, rateLimit(services.limiter, "gemini", 10, 60), asyncRoute(async (request, response) => {
    const {question} = z.object({question: z.string().trim().min(3).max(2000)}).parse(request.body);
    const source = await services.store.getSnapshotSource(request.authorizedClientId!);
    if (!source) { response.status(409).json({error: "CLIENT_FINANCIAL_DATA_INCOMPLETE"}); return; }
    const context = JSON.stringify(buildAnonymousSubmissionSnapshot(snapshotSourceWithAges(source, services.encryption)));
    const started = Date.now();
    try {
      const answer = await services.gemini.analyze(context, question);
      await services.store.addAiLog({clientId: request.authorizedClientId!, userId: request.user!.id, model: services.env.GEMINI_MODEL, promptCharacters: context.length + question.length, status: "SUCCESS", durationMs: Date.now() - started});
      response.json({answer});
    } catch {
      await services.store.addAiLog({clientId: request.authorizedClientId!, userId: request.user!.id, model: services.env.GEMINI_MODEL, promptCharacters: context.length + question.length, status: "FAILED", durationMs: Date.now() - started, error: "AI request failed"});
      response.status(502).json({error: "AI_REQUEST_FAILED", requestId: request.requestId});
    }
  }));

  app.use((_request, response) => response.status(404).json({error: "NOT_FOUND"}));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof z.ZodError) {
      const fieldErrors = Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message]));
      response.status(400).json({
        error: "VALIDATION_ERROR",
        message: "יש לתקן את השדות המסומנים",
        fields: Object.keys(fieldErrors),
        fieldErrors,
        requestId: request.requestId
      });
      return;
    }
    if (error instanceof multer.MulterError) {
      response.status(400).json({error: error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR", requestId: request.requestId});
      return;
    }
    console.error("Request failed", {requestId: request.requestId, errorCode: "UNHANDLED_REQUEST_ERROR"});
    response.status(500).json({error: "INTERNAL_SERVER_ERROR", requestId: request.requestId});
  });

  return app;
}

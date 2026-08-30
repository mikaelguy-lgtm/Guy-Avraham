import { createHash } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, isNull, max, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  advisorProfiles,
  aiAnalysisLogs,
  auditLogs,
  borrowers,
  clients,
  creditIndications,
  documents,
  emailConfigurations,
  emailLogs,
  employmentRecords,
  identityRevealRequests,
  incomeSources,
  legalDocumentAcceptances,
  legalDocumentVersions,
  lenderInviteTokens,
  lenderContacts,
  lenderResponses,
  lenderSubmissions,
  lenderUsers,
  lenders,
  liabilities,
  loanRequests,
  notifications,
  properties,
  systemSettings,
  users
} from "../db/schema.js";
import type { AdvisorAccount, AnonymousSubmissionSnapshot, DatabaseUser, IdentityField, UserStatus } from "../domain/types.js";
import type { LegalDocumentType, LegalDocumentVersionRecord } from "../domain/legalDocuments.js";
import type { AuthorizationDirectory } from "../middleware/auth.js";
import { listMissingRequiredDocuments } from "../domain/requiredDocuments.js";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export interface BorrowerMutationRecord {
  borrowerOrder: number;
  isPrimary: boolean;
  firstNameEncrypted: string;
  lastNameEncrypted: string;
  identityNumberEncrypted: string;
  identityNumberHash: string;
  birthDateEncrypted: string;
  phoneEncrypted: string;
  emailEncrypted: string;
  addressEncrypted: string;
  cityEncrypted: string;
  streetAddressEncrypted: string;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  fullNameEncrypted: string;
  employmentType: string;
  employerNameEncrypted: string;
  jobTitle: string;
  employmentSeniorityYears: number;
  selfEmployedBusinessTypeEncrypted: string | null;
  selfEmployedBusinessStartYear: number | null;
  selfEmployedLastAssessedIncome: number | null;
  selfEmployedAssessmentYear: number | null;
  selfEmployedAccountantIncomePreviousYear: number | null;
  selfEmployedAccountantIncomeCurrentYear: number | null;
  selfEmployedAccountantMonthsCount: number | null;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescriptionEncrypted: string | null;
  additionalIncomes: AdditionalIncomeMutationRecord[];
  liabilities: LiabilityMutationRecord[];
}

export interface AdditionalIncomeMutationRecord {
  sourceType: string;
  monthlyAmount: number;
  descriptionEncrypted: string | null;
}

export interface PersonalBorrowerMutationRecord {
  id: number;
  borrowerOrder: number;
  isPrimary: boolean;
  firstNameEncrypted: string;
  lastNameEncrypted: string;
  identityNumberEncrypted: string;
  identityNumberHash: string;
  birthDateEncrypted: string;
  phoneEncrypted: string;
  emailEncrypted: string;
  addressEncrypted: string;
  cityEncrypted: string;
  streetAddressEncrypted: string;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  fullNameEncrypted: string;
}

export interface ClientPersonalMutationRecord {
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerRelationshipOtherEncrypted: string | null;
  householdChildrenCount: number;
  householdChildrenAges: number[];
  borrowers: PersonalBorrowerMutationRecord[];
}

export interface ClientIncomeMutationRecord {
  borrowers: Array<{
    id: number;
    employmentType: string;
    employerNameEncrypted: string;
    jobTitle: string;
    employmentSeniorityYears: number;
    selfEmployedBusinessTypeEncrypted: string | null;
    selfEmployedBusinessStartYear: number | null;
    selfEmployedLastAssessedIncome: number | null;
    selfEmployedAssessmentYear: number | null;
    selfEmployedAccountantIncomePreviousYear: number | null;
    selfEmployedAccountantIncomeCurrentYear: number | null;
    selfEmployedAccountantMonthsCount: number | null;
    monthlyNetIncome: number;
    hasAdditionalIncome: boolean;
    additionalIncomeType: string | null;
    additionalIncomeAmount: number;
    additionalIncomeDescriptionEncrypted: string | null;
    additionalIncomes: AdditionalIncomeMutationRecord[];
  }>;
}

export interface ClientLiabilitiesMutationRecord {
  borrowers: Array<{id: number; liabilities: LiabilityMutationRecord[]}>;
  householdLiabilities: LiabilityMutationRecord[];
}

export interface ClientPropertyMutationRecord {
  loanPurpose: string;
  propertyType: string;
  propertyTypeOtherDescriptionEncrypted: string | null;
  propertyCity: string;
  propertyAddressEncrypted: string;
  propertyValue: number;
  requestedAmount: number;
}

export interface LiabilityMutationRecord {
  liabilityType: "LOAN" | "MORTGAGE" | "ALIMONY" | "RENT" | "OTHER_FINANCIAL_ENTITY";
  otherTypeDescriptionEncrypted: string | null;
  financialInstitutionEncrypted?: string | null;
  currentBalance: number | null;
  monthlyPayment: number;
  endDate: string;
  notesEncrypted: string;
}

export interface ClientMutationRecord {
  dealDetailsEncrypted: string;
  dealDetailsUpdatedByUserId: number;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerRelationshipOtherEncrypted: string | null;
  householdChildrenCount: number;
  householdChildrenAges: number[];
  borrowers: BorrowerMutationRecord[];
  householdLiabilities: LiabilityMutationRecord[];
  loanPurpose: string;
  propertyType: string;
  propertyTypeOtherDescriptionEncrypted: string | null;
  propertyCity: string;
  propertyAddressEncrypted: string;
  propertyValue: number;
  requestedAmount: number;
  status: "ACTIVE";
}

export interface CreateClientRecord extends ClientMutationRecord {
  publicCaseNumber: string;
  advisorId: number;
}

export interface ClientRecord {
  id: number;
  publicCaseNumber: string;
  advisorId: number;
  status: "DRAFT" | "ACTIVE" | "SUBMITTED" | "CLOSED" | "ARCHIVED";
  firstNameEncrypted: string;
  lastNameEncrypted: string;
  identityNumberEncrypted: string;
  phoneEncrypted: string;
  emailEncrypted: string;
  addressEncrypted: string | null;
  notesEncrypted: string | null;
  dealDetailsEncrypted: string | null;
  dealDetailsUpdatedByUserId: number | null;
  dealDetailsUpdatedAt: Date | null;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  borrowerCount: number;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerRelationshipOtherEncrypted: string | null;
  householdChildrenCount: number;
  householdChildrenAges: number[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BorrowerFinancialDetails {
  id: number;
  borrowerOrder: number;
  isPrimary: boolean;
  firstNameEncrypted: string | null;
  lastNameEncrypted: string | null;
  identityNumberEncrypted: string;
  birthDateEncrypted: string | null;
  birthDate: Date | null;
  phoneEncrypted: string | null;
  emailEncrypted: string | null;
  addressEncrypted: string | null;
  cityEncrypted: string | null;
  streetAddressEncrypted: string | null;
  maritalStatus: string | null;
  numberOfChildren: number;
  childrenAges: number[];
  employmentType: string;
  employerNameEncrypted: string | null;
  jobTitle: string;
  employmentStartDate: Date | null;
  employmentSeniorityYears: number;
  selfEmployedBusinessTypeEncrypted: string | null;
  selfEmployedBusinessStartYear: number | null;
  selfEmployedLastAssessedIncome: number | null;
  selfEmployedAssessmentYear: number | null;
  selfEmployedAccountantIncomePreviousYear: number | null;
  selfEmployedAccountantIncomeCurrentYear: number | null;
  selfEmployedAccountantMonthsCount: number | null;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescriptionEncrypted: string | null;
  additionalIncomes?: Array<{id: number; sortOrder: number; sourceType: string; monthlyAmount: number; descriptionEncrypted: string | null}>;
  liabilities: LiabilityFinancialDetails[];
}

export interface LiabilityFinancialDetails {
  id: number;
  scope: string;
  liabilityType: string;
  otherTypeDescriptionEncrypted: string | null;
  financialInstitutionEncrypted?: string | null;
  currentBalance: number | null;
  monthlyPayment: number;
  endDate: string | null;
  notesEncrypted: string | null;
  legacyStatus: string | null;
}

export interface ClientFinancialDetails {
  borrowers: BorrowerFinancialDetails[];
  birthDate: Date | null;
  employmentType: string;
  employerNameEncrypted: string | null;
  jobTitle: string;
  employmentStartDate: Date | null;
  employmentSeniorityYears: number;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescriptionEncrypted: string | null;
  householdLiabilities: LiabilityFinancialDetails[];
  loanPurpose: string;
  propertyType: string;
  propertyCity: string;
  propertyAddressEncrypted: string | null;
  propertyTypeOtherDescriptionEncrypted: string | null;
  propertyValue: number;
  requestedAmount: number;
  financingPercentage: number;
  latestSubmissionStatus: string | null;
}

export interface CreditIndicationRecord {
  bouncedChecks: boolean | null;
  bouncedChecksCount: number | null;
  bouncedDirectDebits: boolean | null;
  bouncedDirectDebitsCount: number | null;
  collectionProceedings: boolean | null;
  bankruptcy: boolean | null;
  liens: boolean | null;
  mortgageArrears: boolean | null;
}

export interface DocumentRecord {
  id: number;
  clientId: number;
  borrowerId: number | null;
  uploadedByUserId: number;
  documentType: string;
  customTitle: string | null;
  descriptionEncrypted: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
  deletedAt: Date | null;
}

export type EmailProvider = "GMAIL" | "BREVO" | "CUSTOM";
export type EmailSecurityMode = "NONE" | "STARTTLS" | "TLS";
export type EmailConfigurationStatus = "DRAFT" | "TESTED" | "ACTIVE" | "FAILED" | "SUPERSEDED";

export interface EmailConfigurationRecord {
  id: number;
  provider: EmailProvider;
  status: EmailConfigurationStatus;
  host: string;
  port: number;
  securityMode: EmailSecurityMode;
  username: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  secretName: string | null;
  secretVersion: string | null;
  previousConfigurationId: number | null;
  lastTestedAt: Date | null;
  lastTestFailureCode: string | null;
  activatedAt: Date | null;
  supersededAt: Date | null;
  createdByUserId: number;
  updatedByUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailConfigurationRecord {
  provider: EmailProvider;
  host: string;
  port: number;
  securityMode: EmailSecurityMode;
  username: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  secretName: string | null;
  secretVersion: string | null;
  previousConfigurationId: number | null;
  userId: number;
}

export interface InviteValidation {
  tokenId: number;
  submissionId: number;
  lenderId: number;
  lenderName: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export interface AppStore extends AuthorizationDirectory {
  findUserByEmail(email: string): Promise<DatabaseUser | null>;
  getUserDisplayName(userId: number): Promise<string | null>;
  createAdvisorAccount(values: {firebaseUid: string; email: string; firstName: string; lastName: string; phoneEncrypted: string; businessName: string; businessPhoneEncrypted: string; businessEmail: string}): Promise<AdvisorAccount>;
  activateVerifiedAdvisor(userId: number): Promise<AdvisorAccount | null>;
  recordLogin(userId: number): Promise<void>;
  getAdvisorAccount(userId: number, options?: {includeArchived?: boolean}): Promise<AdvisorAccount | null>;
  listAdvisorAccounts(options?: {includeArchived?: boolean}): Promise<AdvisorAccount[]>;
  updateAdvisorProfile(userId: number, values: {firstName: string; lastName: string; phoneEncrypted: string; businessName: string; businessPhoneEncrypted: string}): Promise<AdvisorAccount | null>;
  updateAdvisorStatus(userId: number, status: UserStatus): Promise<AdvisorAccount | null>;
  archiveAdvisorAccount(userId: number): Promise<AdvisorAccount | null>;
  restoreAdvisorAccount(userId: number): Promise<AdvisorAccount | null>;
  updateAdvisorEmail(userId: number, email: string): Promise<AdvisorAccount | null>;
  softDeleteAdvisorAccount(userId: number): Promise<void>;
  listClients(advisorId: number | null, page: number, pageSize: number, search: string): Promise<{items: ClientRecord[]; total: number}>;
  createClient(record: CreateClientRecord): Promise<ClientRecord>;
  getClient(id: number): Promise<ClientRecord | null>;
  getClientDetails(id: number): Promise<ClientFinancialDetails | null>;
  updateClient(id: number, record: ClientMutationRecord): Promise<ClientRecord | null>;
  updateClientPersonal(id: number, record: ClientPersonalMutationRecord): Promise<ClientRecord | null>;
  updateClientIncome(id: number, record: ClientIncomeMutationRecord): Promise<ClientRecord | null>;
  updateClientLiabilities(id: number, record: ClientLiabilitiesMutationRecord): Promise<ClientRecord | null>;
  updateClientProperty(id: number, record: ClientPropertyMutationRecord): Promise<ClientRecord | null>;
  updateClientDealDetails(id: number, dealDetailsEncrypted: string, updatedByUserId: number): Promise<ClientRecord | null>;
  softDeleteClient(id: number): Promise<void>;
  createDocument(values: Omit<DocumentRecord, "id" | "status" | "deletedAt">): Promise<DocumentRecord>;
  getDocument(id: number): Promise<DocumentRecord | null>;
  listDocuments(clientId: number): Promise<DocumentRecord[]>;
  listMissingRequiredDocuments(clientId: number): Promise<Array<{documentType: string; borrowerId: number | null; borrowerOrder: number | null; label: string}>>;
  hasIncompleteLegacyLiabilities(clientId: number): Promise<boolean>;
  softDeleteDocument(id: number): Promise<void>;
  listLenders(): Promise<Array<{id: number; name: string; contactEmail: string}>>;
  listClientSubmissions(clientId: number): Promise<Array<{id: number; lenderId: number; lenderName: string; status: string; updatedAt: Date}>>;
  getSnapshotSource(clientId: number): Promise<{
    publicCaseNumber: string; loanPurpose: string; propertyType: string; propertyCity: string; propertyValue: number;
    requestedAmount: number; numberOfBorrowers: number; borrowerRelationship: string | null;
    employmentTypes: string[]; borrowerBirthDatesEncrypted: Array<string | null>; borrowerBirthDates: Array<Date | null>;
    totalMonthlyIncome: number; liabilityCount: number; totalLiabilityBalance: number; totalMonthlyPayments: number;
    liabilityTypeBreakdown: Record<string, number>;
  } | null>;
  createSubmission(values: {clientId: number; lenderId: number; createdByUserId: number; snapshot: AnonymousSubmissionSnapshot; pdfStorageKey: string; tokenHash: string; expiresAt: Date}): Promise<{id: number}>;
  revokeSubmissionInvites(submissionId: number): Promise<void>;
  markSubmissionSent(submissionId: number, messageId: string, recipient: string): Promise<void>;
  markSubmissionDeliveryFailed(submissionId: number, recipient: string, sanitizedError: string): Promise<void>;
  prepareSubmissionRetry(submissionId: number, advisorId: number, tokenHash: string, expiresAt: Date): Promise<{recipient: string; publicCaseNumber: string} | null>;
  validateInvite(tokenHash: string): Promise<InviteValidation | null>;
  consumeInvite(tokenId: number, userId: number): Promise<void>;
  getLenderSubmission(submissionId: number): Promise<{id: number; lenderId: number; clientId: number; status: string; anonymousSnapshot: AnonymousSubmissionSnapshot} | null>;
  listLenderSubmissions(lenderId: number): Promise<Array<{id: number; status: string; anonymousSnapshot: AnonymousSubmissionSnapshot}>>;
  createLenderResponse(submissionId: number, userId: number, responseType: "MESSAGE" | "MORE_INFO_REQUEST" | "INTERESTED" | "DECLINED", message: string): Promise<{id: number}>;
  createIdentityRequest(submissionId: number, userId: number, reason: string, requestedFields: IdentityField[]): Promise<{id: number}>;
  listAdvisorIdentityRequests(advisorId: number): Promise<unknown[]>;
  decideIdentityRequest(requestId: number, advisorId: number, userId: number, approvedFields: IdentityField[], approvedDocumentIds: number[], approve: boolean): Promise<boolean>;
  getRevealedData(submissionId: number): Promise<{clientId: number; approvedFields: IdentityField[]; approvedDocumentIds: number[]} | null>;
  getIdentityData(clientId: number): Promise<{firstNameEncrypted: string; lastNameEncrypted: string; phoneEncrypted: string; emailEncrypted: string; identityNumberEncrypted: string; propertyAddressEncrypted: string | null; employerNameEncrypted: string | null} | null>;
  getCreditIndication(clientId: number): Promise<CreditIndicationRecord | null>;
  upsertCreditIndication(clientId: number, values: CreditIndicationRecord): Promise<CreditIndicationRecord>;
  getSettings(category: string): Promise<Array<{key: string; value: string | null; isSecret: boolean}>>;
  setSettings(category: string, values: Record<string, string>, userId: number): Promise<void>;
  listEmailConfigurations(): Promise<EmailConfigurationRecord[]>;
  getEmailConfiguration(id: number): Promise<EmailConfigurationRecord | null>;
  getActiveEmailConfiguration(): Promise<EmailConfigurationRecord | null>;
  createEmailConfiguration(values: CreateEmailConfigurationRecord): Promise<EmailConfigurationRecord>;
  clearEmailConfigurationPassword(id: number, userId: number): Promise<EmailConfigurationRecord | null>;
  markEmailConfigurationTest(id: number, status: "TESTED" | "FAILED", failureCode: string | null, userId: number): Promise<EmailConfigurationRecord | null>;
  activateEmailConfiguration(id: number, userId: number): Promise<EmailConfigurationRecord | null>;
  rollbackEmailConfiguration(userId: number): Promise<EmailConfigurationRecord | null>;
  addEmailLog(values: {recipient: string; template?: string; userId?: number; requestId?: string; messageId?: string; status: "SENT" | "FAILED"; sanitizedError?: string}): Promise<void>;
  getLatestEmailLog(userId: number, template: string): Promise<{recipient: string; template: string | null; messageId: string | null; status: string; sentAt: Date | null; failedAt: Date | null; requestId: string | null} | null>;
  listEmailLogs(recipient: string): Promise<Array<{recipient: string; template: string | null; messageId: string | null; status: string; sentAt: Date | null; failedAt: Date | null; requestId: string | null}>>;
  listRecentEmailLogs(limit: number): Promise<Array<{recipient: string; template: string | null; status: string; sanitizedError: string | null; requestId: string | null; sentAt: Date | null; failedAt: Date | null; createdAt: Date; attempts: number; resent: boolean}>>;
  addAudit(userId: number | null, action: string, entityType: string | null, entityId: number | null, metadata: Record<string, unknown> | null, requestId?: string, ipAddress?: string, userAgent?: string): Promise<void>;
  addAiLog(values: {clientId: number; userId: number; model: string; promptCharacters: number; status: string; durationMs?: number; error?: string}): Promise<void>;
  notifyAdvisor(clientId: number, type: string, title: string, body: string): Promise<void>;
  listNotifications(userId: number): Promise<unknown[]>;
  markNotificationRead(id: number, userId: number): Promise<boolean>;
  markAllNotificationsRead(userId: number): Promise<number>;
  listAuditLogs(limit: number): Promise<unknown[]>;
  listUserAuditEvents(userId: number, actions: string[]): Promise<Array<{action: string; metadata: Record<string, unknown> | null; createdAt: Date; actorUserId: number | null}>>;
  listLegalDocumentVersions(documentType: LegalDocumentType): Promise<LegalDocumentVersionRecord[]>;
  getLegalDocumentVersion(id: number): Promise<LegalDocumentVersionRecord | null>;
  getActiveLegalDocumentVersion(documentType: LegalDocumentType): Promise<LegalDocumentVersionRecord | null>;
  getDraftLegalDocumentVersion(documentType: LegalDocumentType): Promise<LegalDocumentVersionRecord | null>;
  createLegalDocumentDraft(documentType: LegalDocumentType, userId: number): Promise<LegalDocumentVersionRecord>;
  updateLegalDocumentDraft(id: number, values: {title: string; content: string; contactEmail: string | null; contactPhone: string | null; contactAddress: string | null; effectiveDate: string | null}): Promise<LegalDocumentVersionRecord | null>;
  discardLegalDocumentDraft(id: number): Promise<boolean>;
  publishLegalDocumentVersion(id: number, userId: number): Promise<LegalDocumentVersionRecord | null>;
  countLegalDocumentAcceptances(versionId: number): Promise<number>;
  recordLegalDocumentAcceptance(userId: number, documentType: LegalDocumentType, versionId: number, context: {ip?: string; userAgent?: string}): Promise<void>;
  listLegalDocumentAcceptancesForUser(userId: number): Promise<Array<{documentType: LegalDocumentType; versionId: number; versionNumber: number; title: string; acceptedAt: Date; contentHash: string | null; status: string}>>;
}

export class PostgresStore implements AppStore {
  async getUserDisplayName(userId: number): Promise<string | null> {
    const [user] = await db.select({firstName: users.firstName, lastName: users.lastName}).from(users).where(eq(users.id, userId)).limit(1);
    return user ? `${user.firstName} ${user.lastName}`.trim() : null;
  }

  async findUserByFirebaseUid(uid: string): Promise<DatabaseUser | null> {
    const [row] = await db.select({
      id: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName,
      role: users.role, roleLabel: users.roleLabel, status: users.status, emailVerified: users.emailVerified, deletedAt: users.deletedAt,
      advisorId: advisorProfiles.id, lenderId: lenderUsers.lenderId
    }).from(users)
      .leftJoin(advisorProfiles, eq(advisorProfiles.userId, users.id))
      .leftJoin(lenderUsers, eq(lenderUsers.userId, users.id))
      .where(eq(users.firebaseUid, uid)).limit(1);
    return row ?? null;
  }

  async findUserByEmail(email: string): Promise<DatabaseUser | null> {
    const [row] = await db.select({
      id: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName,
      role: users.role, roleLabel: users.roleLabel, status: users.status, emailVerified: users.emailVerified, deletedAt: users.deletedAt,
      advisorId: advisorProfiles.id, lenderId: lenderUsers.lenderId
    }).from(users)
      .leftJoin(advisorProfiles, eq(advisorProfiles.userId, users.id))
      .leftJoin(lenderUsers, eq(lenderUsers.userId, users.id))
      .where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async createAdvisorAccount(values: {firebaseUid: string; email: string; firstName: string; lastName: string; phoneEncrypted: string; businessName: string; businessPhoneEncrypted: string; businessEmail: string}): Promise<AdvisorAccount> {
    const userId = await db.transaction(async (transaction) => {
      const [user] = await transaction.insert(users).values({
        firebaseUid: values.firebaseUid, email: values.email, firstName: values.firstName, lastName: values.lastName,
        phoneEncrypted: values.phoneEncrypted, role: "ADVISOR", roleLabel: "יועץ משכנתאות", status: "PENDING", emailVerified: false
      }).returning({id: users.id});
      await transaction.insert(advisorProfiles).values({
        userId: user.id, businessName: values.businessName, businessPhoneEncrypted: values.businessPhoneEncrypted, businessEmail: values.businessEmail
      });
      return user.id;
    });
    const account = await this.getAdvisorAccount(userId);
    if (!account) throw new Error("ADVISOR_ACCOUNT_NOT_CREATED");
    return account;
  }

  async getAdvisorAccount(userId: number, options?: {includeArchived?: boolean}): Promise<AdvisorAccount | null> {
    const [row] = await db.select({
      id: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName,
      phoneEncrypted: users.phoneEncrypted, role: users.role, roleLabel: users.roleLabel, status: users.status,
      emailVerified: users.emailVerified, deletedAt: users.deletedAt, advisorId: advisorProfiles.id,
      lenderId: sql<number | null>`null`, businessName: advisorProfiles.businessName,
      businessPhoneEncrypted: advisorProfiles.businessPhoneEncrypted, businessEmail: advisorProfiles.businessEmail,
      createdAt: users.createdAt, updatedAt: users.updatedAt, lastLoginAt: users.lastLoginAt
    }).from(users).innerJoin(advisorProfiles, eq(advisorProfiles.userId, users.id))
      .where(and(eq(users.id, userId), eq(users.role, "ADVISOR"), options?.includeArchived ? undefined : isNull(users.deletedAt))).limit(1);
    return row ?? null;
  }

  async listAdvisorAccounts(options?: {includeArchived?: boolean}): Promise<AdvisorAccount[]> {
    return db.select({
      id: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName,
      phoneEncrypted: users.phoneEncrypted, role: users.role, roleLabel: users.roleLabel, status: users.status,
      emailVerified: users.emailVerified, deletedAt: users.deletedAt, advisorId: advisorProfiles.id,
      lenderId: sql<number | null>`null`, businessName: advisorProfiles.businessName,
      businessPhoneEncrypted: advisorProfiles.businessPhoneEncrypted, businessEmail: advisorProfiles.businessEmail,
      createdAt: users.createdAt, updatedAt: users.updatedAt, lastLoginAt: users.lastLoginAt
    }).from(users).innerJoin(advisorProfiles, eq(advisorProfiles.userId, users.id))
      .where(and(eq(users.role, "ADVISOR"), options?.includeArchived ? undefined : isNull(users.deletedAt))).orderBy(desc(users.createdAt));
  }

  async archiveAdvisorAccount(userId: number): Promise<AdvisorAccount | null> {
    await db.update(users).set({deletedAt: new Date(), updatedAt: new Date()}).where(and(eq(users.id, userId), eq(users.role, "ADVISOR")));
    return this.getAdvisorAccount(userId, {includeArchived: true});
  }

  async restoreAdvisorAccount(userId: number): Promise<AdvisorAccount | null> {
    await db.update(users).set({deletedAt: null, updatedAt: new Date()}).where(and(eq(users.id, userId), eq(users.role, "ADVISOR")));
    return this.getAdvisorAccount(userId);
  }

  async updateAdvisorEmail(userId: number, email: string): Promise<AdvisorAccount | null> {
    await db.transaction(async (transaction) => {
      await transaction.update(users).set({email, emailVerified: false, status: "PENDING", updatedAt: new Date()})
        .where(and(eq(users.id, userId), eq(users.role, "ADVISOR")));
      await transaction.update(advisorProfiles).set({businessEmail: email, updatedAt: new Date()}).where(eq(advisorProfiles.userId, userId));
    });
    return this.getAdvisorAccount(userId);
  }

  async activateVerifiedAdvisor(userId: number): Promise<AdvisorAccount | null> {
    await db.update(users).set({emailVerified: true, status: "ACTIVE", lastLoginAt: new Date(), updatedAt: new Date()})
      .where(and(eq(users.id, userId), eq(users.role, "ADVISOR"), eq(users.status, "PENDING")));
    return this.getAdvisorAccount(userId);
  }

  async recordLogin(userId: number): Promise<void> {
    await db.update(users).set({lastLoginAt: new Date(), updatedAt: new Date()}).where(eq(users.id, userId));
  }

  async updateAdvisorProfile(userId: number, values: {firstName: string; lastName: string; phoneEncrypted: string; businessName: string; businessPhoneEncrypted: string}): Promise<AdvisorAccount | null> {
    await db.transaction(async (transaction) => {
      await transaction.update(users).set({firstName: values.firstName, lastName: values.lastName, phoneEncrypted: values.phoneEncrypted, updatedAt: new Date()})
        .where(and(eq(users.id, userId), eq(users.role, "ADVISOR")));
      await transaction.update(advisorProfiles).set({businessName: values.businessName, businessPhoneEncrypted: values.businessPhoneEncrypted, updatedAt: new Date()})
        .where(eq(advisorProfiles.userId, userId));
    });
    return this.getAdvisorAccount(userId);
  }

  async updateAdvisorStatus(userId: number, status: UserStatus): Promise<AdvisorAccount | null> {
    await db.update(users).set({status, updatedAt: new Date()}).where(and(eq(users.id, userId), eq(users.role, "ADVISOR")));
    return this.getAdvisorAccount(userId);
  }

  async softDeleteAdvisorAccount(userId: number): Promise<void> {
    await db.update(users).set({status: "DISABLED", deletedAt: new Date(), updatedAt: new Date()})
      .where(and(eq(users.id, userId), eq(users.role, "ADVISOR")));
  }

  async getClientAdvisorId(clientId: number): Promise<number | null> {
    const [row] = await db.select({advisorId: clients.advisorId}).from(clients)
      .where(and(eq(clients.id, clientId), isNull(clients.deletedAt))).limit(1);
    return row?.advisorId ?? null;
  }

  async getSubmissionAccess(submissionId: number) {
    return this.getLenderSubmission(submissionId);
  }

  async listClients(advisorId: number | null, page: number, pageSize: number, search: string) {
    const clauses = [isNull(clients.deletedAt)];
    if (advisorId !== null) clauses.push(eq(clients.advisorId, advisorId));
    if (search) clauses.push(ilike(clients.publicCaseNumber, `%${search}%`));
    const where = and(...clauses);
    const items = await db.select().from(clients).where(where).orderBy(desc(clients.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    const [count] = await db.select({value: sql<number>`count(*)::int`}).from(clients).where(where);
    return {items, total: count?.value ?? 0};
  }

  async createClient(record: CreateClientRecord): Promise<ClientRecord> {
    return db.transaction(async (transaction) => {
      const primary = record.borrowers[0];
      const [client] = await transaction.insert(clients).values({
        publicCaseNumber: record.publicCaseNumber,
        advisorId: record.advisorId,
        firstNameEncrypted: primary.firstNameEncrypted,
        lastNameEncrypted: primary.lastNameEncrypted,
        identityNumberEncrypted: primary.identityNumberEncrypted,
        phoneEncrypted: primary.phoneEncrypted,
        emailEncrypted: primary.emailEncrypted,
        addressEncrypted: primary.addressEncrypted,
        notesEncrypted: record.dealDetailsEncrypted,
        dealDetailsEncrypted: record.dealDetailsEncrypted,
        dealDetailsUpdatedByUserId: record.dealDetailsUpdatedByUserId,
        dealDetailsUpdatedAt: new Date(),
        maritalStatus: primary.maritalStatus,
        numberOfChildren: primary.numberOfChildren,
        childrenAges: primary.childrenAges,
        borrowerCount: record.numberOfBorrowers,
        numberOfBorrowers: record.numberOfBorrowers,
        borrowerRelationship: record.borrowerRelationship,
        borrowerRelationshipOtherEncrypted: record.borrowerRelationshipOtherEncrypted,
        householdChildrenCount: record.householdChildrenCount,
        householdChildrenAges: record.householdChildrenAges,
        status: record.status
      }).returning();
      for (const borrowerRecord of record.borrowers) {
        const [borrower] = await transaction.insert(borrowers).values({
          clientId: client.id,
          borrowerType: borrowerRecord.isPrimary ? "PRIMARY" : "CO_BORROWER",
          borrowerOrder: borrowerRecord.borrowerOrder,
          isPrimary: borrowerRecord.isPrimary,
          fullNameEncrypted: borrowerRecord.fullNameEncrypted,
          firstNameEncrypted: borrowerRecord.firstNameEncrypted,
          lastNameEncrypted: borrowerRecord.lastNameEncrypted,
          identityNumberEncrypted: borrowerRecord.identityNumberEncrypted,
          identityNumberHash: borrowerRecord.identityNumberHash,
          birthDateEncrypted: borrowerRecord.birthDateEncrypted,
          phoneEncrypted: borrowerRecord.phoneEncrypted,
          emailEncrypted: borrowerRecord.emailEncrypted,
          addressEncrypted: borrowerRecord.addressEncrypted,
          cityEncrypted: borrowerRecord.cityEncrypted,
          streetAddressEncrypted: borrowerRecord.streetAddressEncrypted,
          maritalStatus: borrowerRecord.maritalStatus,
          numberOfChildren: borrowerRecord.numberOfChildren,
          childrenAges: borrowerRecord.childrenAges
        }).returning({id: borrowers.id});
        await transaction.insert(employmentRecords).values({
          borrowerId: borrower.id, employmentType: borrowerRecord.employmentType,
          employerNameEncrypted: borrowerRecord.employerNameEncrypted, jobTitle: borrowerRecord.jobTitle,
          employmentSeniorityYears: borrowerRecord.employmentSeniorityYears,
          selfEmployedBusinessTypeEncrypted: borrowerRecord.selfEmployedBusinessTypeEncrypted,
          selfEmployedBusinessStartYear: borrowerRecord.selfEmployedBusinessStartYear,
          selfEmployedLastAssessedIncome: borrowerRecord.selfEmployedLastAssessedIncome === null ? null : String(borrowerRecord.selfEmployedLastAssessedIncome),
          selfEmployedAssessmentYear: borrowerRecord.selfEmployedAssessmentYear,
          selfEmployedAccountantIncomePreviousYear: borrowerRecord.selfEmployedAccountantIncomePreviousYear === null ? null : String(borrowerRecord.selfEmployedAccountantIncomePreviousYear),
          selfEmployedAccountantIncomeCurrentYear: borrowerRecord.selfEmployedAccountantIncomeCurrentYear === null ? null : String(borrowerRecord.selfEmployedAccountantIncomeCurrentYear),
          selfEmployedAccountantMonthsCount: borrowerRecord.selfEmployedAccountantMonthsCount,
          monthlyNetIncome: String(borrowerRecord.monthlyNetIncome),
          hasAdditionalIncome: borrowerRecord.hasAdditionalIncome, additionalIncomeType: borrowerRecord.additionalIncomeType,
          additionalIncomeAmount: String(borrowerRecord.additionalIncomeAmount),
          additionalIncomeDescriptionEncrypted: borrowerRecord.additionalIncomeDescriptionEncrypted
        });
        if (borrowerRecord.additionalIncomes.length > 0) await transaction.insert(incomeSources).values(borrowerRecord.additionalIncomes.map((income, index) => ({
          borrowerId: borrower.id, sortOrder: index + 1, sourceType: income.sourceType,
          monthlyAmount: String(income.monthlyAmount), descriptionEncrypted: income.descriptionEncrypted
        })));
        if (borrowerRecord.liabilities.length > 0) await transaction.insert(liabilities).values(borrowerRecord.liabilities.map((liability) => ({
          clientId: client.id, borrowerId: borrower.id, scope: "BORROWER", liabilityType: liability.liabilityType,
          outstandingBalance: liability.currentBalance === null ? null : String(liability.currentBalance), currentBalance: liability.currentBalance === null ? null : String(liability.currentBalance),
          monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate,
          financialInstitutionEncrypted: liability.financialInstitutionEncrypted,
          otherTypeDescriptionEncrypted: liability.otherTypeDescriptionEncrypted, notesEncrypted: liability.notesEncrypted
        })));
      }
      if (record.householdLiabilities.length > 0) await transaction.insert(liabilities).values(record.householdLiabilities.map((liability) => ({
        clientId: client.id, borrowerId: null, scope: "HOUSEHOLD", liabilityType: liability.liabilityType,
        outstandingBalance: liability.currentBalance === null ? null : String(liability.currentBalance), currentBalance: liability.currentBalance === null ? null : String(liability.currentBalance),
        monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate,
        financialInstitutionEncrypted: liability.financialInstitutionEncrypted,
        otherTypeDescriptionEncrypted: liability.otherTypeDescriptionEncrypted, notesEncrypted: liability.notesEncrypted
      })));
      await transaction.insert(properties).values({
        clientId: client.id, propertyType: record.propertyType, region: "LEGACY_UNUSED", city: record.propertyCity,
        addressEncrypted: record.propertyAddressEncrypted, estimatedValue: String(record.propertyValue),
        existingMortgageBalance: "0",
        propertyTypeOtherDescriptionEncrypted: record.propertyTypeOtherDescriptionEncrypted
      });
      await transaction.insert(loanRequests).values({
        clientId: client.id, purpose: record.loanPurpose, requestedAmount: String(record.requestedAmount),
        requestedTermMonths: 1,
        loanToValue: String(record.propertyValue > 0 ? (record.requestedAmount / record.propertyValue) * 100 : 0)
      });
      return client;
    });
  }

  async getClient(id: number): Promise<ClientRecord | null> {
    const [row] = await db.select().from(clients).where(and(eq(clients.id, id), isNull(clients.deletedAt))).limit(1);
    return row ?? null;
  }

  async getClientDetails(id: number): Promise<ClientFinancialDetails | null> {
    const borrowerRows = await db.select({
      id: borrowers.id,
      borrowerOrder: borrowers.borrowerOrder,
      isPrimary: borrowers.isPrimary,
      firstNameEncrypted: borrowers.firstNameEncrypted,
      lastNameEncrypted: borrowers.lastNameEncrypted,
      identityNumberEncrypted: borrowers.identityNumberEncrypted,
      birthDateEncrypted: borrowers.birthDateEncrypted,
      birthDate: borrowers.birthDate,
      phoneEncrypted: borrowers.phoneEncrypted,
      emailEncrypted: borrowers.emailEncrypted,
      addressEncrypted: borrowers.addressEncrypted,
      cityEncrypted: borrowers.cityEncrypted,
      streetAddressEncrypted: borrowers.streetAddressEncrypted,
      maritalStatus: borrowers.maritalStatus,
      numberOfChildren: borrowers.numberOfChildren,
      childrenAges: borrowers.childrenAges,
      employmentType: employmentRecords.employmentType,
      employerNameEncrypted: employmentRecords.employerNameEncrypted,
      jobTitle: employmentRecords.jobTitle,
      employmentStartDate: employmentRecords.startDate,
      monthlyNetIncome: employmentRecords.monthlyNetIncome,
      hasAdditionalIncome: employmentRecords.hasAdditionalIncome,
      additionalIncomeType: employmentRecords.additionalIncomeType,
      additionalIncomeAmount: employmentRecords.additionalIncomeAmount,
      additionalIncomeDescriptionEncrypted: employmentRecords.additionalIncomeDescriptionEncrypted,
      employmentSeniorityYears: employmentRecords.employmentSeniorityYears,
      selfEmployedBusinessTypeEncrypted: employmentRecords.selfEmployedBusinessTypeEncrypted,
      selfEmployedBusinessStartYear: employmentRecords.selfEmployedBusinessStartYear,
      selfEmployedLastAssessedIncome: employmentRecords.selfEmployedLastAssessedIncome,
      selfEmployedAssessmentYear: employmentRecords.selfEmployedAssessmentYear,
      selfEmployedAccountantIncomePreviousYear: employmentRecords.selfEmployedAccountantIncomePreviousYear,
      selfEmployedAccountantIncomeCurrentYear: employmentRecords.selfEmployedAccountantIncomeCurrentYear,
      selfEmployedAccountantMonthsCount: employmentRecords.selfEmployedAccountantMonthsCount
    }).from(borrowers).innerJoin(employmentRecords, eq(borrowers.id, employmentRecords.borrowerId))
      .where(eq(borrowers.clientId, id)).orderBy(asc(borrowers.borrowerOrder));
    const [property] = await db.select().from(properties).where(eq(properties.clientId, id)).limit(1);
    const [loan] = await db.select().from(loanRequests).where(eq(loanRequests.clientId, id)).limit(1);
    if (borrowerRows.length === 0 || !property || !loan) return null;
    const liabilityRows = await db.select({
      id: liabilities.id, borrowerId: liabilities.borrowerId, scope: liabilities.scope, liabilityType: liabilities.liabilityType,
      outstandingBalance: liabilities.outstandingBalance, currentBalance: liabilities.currentBalance, monthlyPayment: liabilities.monthlyPayment,
      endDate: liabilities.endDate, financialInstitutionEncrypted: liabilities.financialInstitutionEncrypted, otherTypeDescriptionEncrypted: liabilities.otherTypeDescriptionEncrypted,
      notesEncrypted: liabilities.notesEncrypted, legacyStatus: liabilities.legacyStatus
    }).from(liabilities).where(and(eq(liabilities.clientId, id), isNull(liabilities.deletedAt)));
    const incomeRows = borrowerRows.length ? await db.select({
      id: incomeSources.id, borrowerId: incomeSources.borrowerId, sortOrder: incomeSources.sortOrder,
      sourceType: incomeSources.sourceType, monthlyAmount: incomeSources.monthlyAmount,
      descriptionEncrypted: incomeSources.descriptionEncrypted
    }).from(incomeSources).where(inArray(incomeSources.borrowerId, borrowerRows.map((row) => row.id))).orderBy(asc(incomeSources.borrowerId), asc(incomeSources.sortOrder)) : [];
    const [latestSubmission] = await db.select({status: lenderSubmissions.status}).from(lenderSubmissions)
      .where(eq(lenderSubmissions.clientId, id)).orderBy(desc(lenderSubmissions.updatedAt)).limit(1);
    const borrowerDetails = borrowerRows.map((borrower) => {
      const ownLiabilities = liabilityRows.filter((row) => row.scope === "BORROWER" && row.borrowerId === borrower.id);
      return {
        ...borrower,
        jobTitle: borrower.jobTitle ?? "",
        monthlyNetIncome: Number(borrower.monthlyNetIncome),
        additionalIncomeAmount: Number(borrower.additionalIncomeAmount),
        selfEmployedLastAssessedIncome: borrower.selfEmployedLastAssessedIncome === null ? null : Number(borrower.selfEmployedLastAssessedIncome),
        selfEmployedAccountantIncomePreviousYear: borrower.selfEmployedAccountantIncomePreviousYear === null ? null : Number(borrower.selfEmployedAccountantIncomePreviousYear),
        selfEmployedAccountantIncomeCurrentYear: borrower.selfEmployedAccountantIncomeCurrentYear === null ? null : Number(borrower.selfEmployedAccountantIncomeCurrentYear),
        additionalIncomes: (() => {
          const normalized = incomeRows.filter((row) => row.borrowerId === borrower.id).map((row) => ({
            id: row.id, sortOrder: row.sortOrder, sourceType: row.sourceType,
            monthlyAmount: Number(row.monthlyAmount), descriptionEncrypted: row.descriptionEncrypted
          }));
          return normalized.length ? normalized : borrower.hasAdditionalIncome && borrower.additionalIncomeType ? [{
            id: 0, sortOrder: 1, sourceType: borrower.additionalIncomeType,
            monthlyAmount: Number(borrower.additionalIncomeAmount), descriptionEncrypted: borrower.additionalIncomeDescriptionEncrypted
          }] : [];
        })(),
        liabilities: ownLiabilities.map((row) => ({
          id: row.id, scope: row.scope, liabilityType: row.liabilityType,
          otherTypeDescriptionEncrypted: row.otherTypeDescriptionEncrypted,
          financialInstitutionEncrypted: row.financialInstitutionEncrypted,
          currentBalance: row.currentBalance === null && row.outstandingBalance === null ? null : Number(row.currentBalance ?? row.outstandingBalance), monthlyPayment: Number(row.monthlyPayment),
          endDate: row.endDate, notesEncrypted: row.notesEncrypted, legacyStatus: row.legacyStatus
        }))
      };
    });
    const primary = borrowerDetails[0];
    return {
      borrowers: borrowerDetails,
      birthDate: primary.birthDate,
      employmentType: primary.employmentType,
      employerNameEncrypted: primary.employerNameEncrypted,
      jobTitle: primary.jobTitle,
      employmentStartDate: primary.employmentStartDate,
      employmentSeniorityYears: primary.employmentSeniorityYears,
      monthlyNetIncome: primary.monthlyNetIncome,
      hasAdditionalIncome: primary.hasAdditionalIncome,
      additionalIncomeType: primary.additionalIncomeType,
      additionalIncomeAmount: primary.additionalIncomeAmount,
      additionalIncomeDescriptionEncrypted: primary.additionalIncomeDescriptionEncrypted,
      householdLiabilities: liabilityRows.filter((row) => row.scope === "HOUSEHOLD").map((row) => ({
        id: row.id, scope: row.scope, liabilityType: row.liabilityType,
        otherTypeDescriptionEncrypted: row.otherTypeDescriptionEncrypted,
        financialInstitutionEncrypted: row.financialInstitutionEncrypted,
        currentBalance: row.currentBalance === null && row.outstandingBalance === null ? null : Number(row.currentBalance ?? row.outstandingBalance), monthlyPayment: Number(row.monthlyPayment),
        endDate: row.endDate, notesEncrypted: row.notesEncrypted, legacyStatus: row.legacyStatus
      })),
      loanPurpose: loan.purpose,
      propertyType: property.propertyType,
      propertyCity: property.city ?? "",
      propertyAddressEncrypted: property.addressEncrypted,
      propertyTypeOtherDescriptionEncrypted: property.propertyTypeOtherDescriptionEncrypted,
      propertyValue: Number(property.estimatedValue),
      requestedAmount: Number(loan.requestedAmount),
      financingPercentage: Number(loan.loanToValue),
      latestSubmissionStatus: latestSubmission?.status ?? null
    };
  }

  async updateClient(id: number, record: ClientMutationRecord): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const primary = record.borrowers[0];
      const [client] = await transaction.update(clients).set({
        firstNameEncrypted: primary.firstNameEncrypted, lastNameEncrypted: primary.lastNameEncrypted,
        identityNumberEncrypted: primary.identityNumberEncrypted, phoneEncrypted: primary.phoneEncrypted,
        emailEncrypted: primary.emailEncrypted, addressEncrypted: primary.addressEncrypted,
        notesEncrypted: record.dealDetailsEncrypted, dealDetailsEncrypted: record.dealDetailsEncrypted,
        dealDetailsUpdatedByUserId: record.dealDetailsUpdatedByUserId, dealDetailsUpdatedAt: new Date(),
        maritalStatus: primary.maritalStatus, numberOfChildren: primary.numberOfChildren, childrenAges: primary.childrenAges,
        borrowerCount: record.numberOfBorrowers, numberOfBorrowers: record.numberOfBorrowers,
        borrowerRelationship: record.borrowerRelationship,
        borrowerRelationshipOtherEncrypted: record.borrowerRelationshipOtherEncrypted,
        householdChildrenCount: record.householdChildrenCount,
        householdChildrenAges: record.householdChildrenAges,
        status: record.status, updatedAt: new Date()
      }).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      if (!client) return null;

      const existingBorrowers = await transaction.select({id: borrowers.id, borrowerOrder: borrowers.borrowerOrder, identityNumberHash: borrowers.identityNumberHash}).from(borrowers)
        .where(eq(borrowers.clientId, id)).orderBy(asc(borrowers.borrowerOrder));
      const [property] = await transaction.select({id: properties.id}).from(properties).where(eq(properties.clientId, id)).limit(1);
      const [loan] = await transaction.select({id: loanRequests.id}).from(loanRequests).where(eq(loanRequests.clientId, id)).limit(1);
      if (!property || !loan) throw new Error("CLIENT_FINANCIAL_DATA_INCOMPLETE");

      await transaction.update(liabilities).set({deletedAt: new Date(), updatedAt: new Date()})
        .where(and(eq(liabilities.clientId, id), isNull(liabilities.deletedAt)));

      const retainedBorrowerIds: number[] = [];
      await transaction.update(borrowers).set({
        borrowerOrder: sql`${borrowers.borrowerOrder} + 100`,
        isPrimary: false,
        borrowerType: "CO_BORROWER",
        updatedAt: new Date()
      }).where(eq(borrowers.clientId, id));
      for (const borrowerRecord of record.borrowers) {
        const existingBorrower = existingBorrowers.find((item) => item.identityNumberHash === borrowerRecord.identityNumberHash)
          ?? existingBorrowers.find((item) => item.borrowerOrder === borrowerRecord.borrowerOrder && !retainedBorrowerIds.includes(item.id));
        let borrowerId: number;
        const borrowerValues = {
          borrowerType: borrowerRecord.isPrimary ? "PRIMARY" : "CO_BORROWER",
          borrowerOrder: borrowerRecord.borrowerOrder,
          isPrimary: borrowerRecord.isPrimary,
          fullNameEncrypted: borrowerRecord.fullNameEncrypted,
          firstNameEncrypted: borrowerRecord.firstNameEncrypted,
          lastNameEncrypted: borrowerRecord.lastNameEncrypted,
          identityNumberEncrypted: borrowerRecord.identityNumberEncrypted,
          identityNumberHash: borrowerRecord.identityNumberHash,
          birthDateEncrypted: borrowerRecord.birthDateEncrypted,
          birthDate: null,
          phoneEncrypted: borrowerRecord.phoneEncrypted,
          emailEncrypted: borrowerRecord.emailEncrypted,
          addressEncrypted: borrowerRecord.addressEncrypted,
          cityEncrypted: borrowerRecord.cityEncrypted,
          streetAddressEncrypted: borrowerRecord.streetAddressEncrypted,
          maritalStatus: borrowerRecord.maritalStatus,
          numberOfChildren: borrowerRecord.numberOfChildren,
          childrenAges: borrowerRecord.childrenAges,
          updatedAt: new Date()
        };
        if (existingBorrower) {
          borrowerId = existingBorrower.id;
          await transaction.update(borrowers).set(borrowerValues).where(eq(borrowers.id, borrowerId));
        } else {
          const [createdBorrower] = await transaction.insert(borrowers).values({clientId: id, ...borrowerValues}).returning({id: borrowers.id});
          borrowerId = createdBorrower.id;
        }
        retainedBorrowerIds.push(borrowerId);
        const [employment] = await transaction.select({id: employmentRecords.id}).from(employmentRecords).where(eq(employmentRecords.borrowerId, borrowerId)).limit(1);
        const employmentValues = {
          employmentType: borrowerRecord.employmentType,
          employerNameEncrypted: borrowerRecord.employerNameEncrypted,
          jobTitle: borrowerRecord.jobTitle,
          employmentSeniorityYears: borrowerRecord.employmentSeniorityYears,
          selfEmployedBusinessTypeEncrypted: borrowerRecord.selfEmployedBusinessTypeEncrypted,
          selfEmployedBusinessStartYear: borrowerRecord.selfEmployedBusinessStartYear,
          selfEmployedLastAssessedIncome: borrowerRecord.selfEmployedLastAssessedIncome === null ? null : String(borrowerRecord.selfEmployedLastAssessedIncome),
          selfEmployedAssessmentYear: borrowerRecord.selfEmployedAssessmentYear,
          selfEmployedAccountantIncomePreviousYear: borrowerRecord.selfEmployedAccountantIncomePreviousYear === null ? null : String(borrowerRecord.selfEmployedAccountantIncomePreviousYear),
          selfEmployedAccountantIncomeCurrentYear: borrowerRecord.selfEmployedAccountantIncomeCurrentYear === null ? null : String(borrowerRecord.selfEmployedAccountantIncomeCurrentYear),
          selfEmployedAccountantMonthsCount: borrowerRecord.selfEmployedAccountantMonthsCount,
          startDate: null,
          monthlyNetIncome: String(borrowerRecord.monthlyNetIncome),
          hasAdditionalIncome: borrowerRecord.hasAdditionalIncome,
          additionalIncomeType: borrowerRecord.additionalIncomeType,
          additionalIncomeAmount: String(borrowerRecord.additionalIncomeAmount),
          additionalIncomeDescriptionEncrypted: borrowerRecord.additionalIncomeDescriptionEncrypted,
          updatedAt: new Date()
        };
        if (employment) await transaction.update(employmentRecords).set(employmentValues).where(eq(employmentRecords.id, employment.id));
        else await transaction.insert(employmentRecords).values({borrowerId, ...employmentValues});
        await transaction.delete(incomeSources).where(eq(incomeSources.borrowerId, borrowerId));
        if (borrowerRecord.additionalIncomes.length > 0) await transaction.insert(incomeSources).values(borrowerRecord.additionalIncomes.map((income, index) => ({
          borrowerId, sortOrder: index + 1, sourceType: income.sourceType,
          monthlyAmount: String(income.monthlyAmount), descriptionEncrypted: income.descriptionEncrypted
        })));
        if (borrowerRecord.liabilities.length > 0) await transaction.insert(liabilities).values(borrowerRecord.liabilities.map((liability) => ({
          clientId: id, borrowerId, scope: "BORROWER", liabilityType: liability.liabilityType,
          outstandingBalance: liability.currentBalance === null ? null : String(liability.currentBalance), currentBalance: liability.currentBalance === null ? null : String(liability.currentBalance),
          monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate,
          financialInstitutionEncrypted: liability.financialInstitutionEncrypted,
          otherTypeDescriptionEncrypted: liability.otherTypeDescriptionEncrypted, notesEncrypted: liability.notesEncrypted
        })));
      }
      if (record.householdLiabilities.length > 0) await transaction.insert(liabilities).values(record.householdLiabilities.map((liability) => ({
        clientId: id, borrowerId: null, scope: "HOUSEHOLD", liabilityType: liability.liabilityType,
        outstandingBalance: liability.currentBalance === null ? null : String(liability.currentBalance), currentBalance: liability.currentBalance === null ? null : String(liability.currentBalance),
        monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate,
        financialInstitutionEncrypted: liability.financialInstitutionEncrypted,
        otherTypeDescriptionEncrypted: liability.otherTypeDescriptionEncrypted, notesEncrypted: liability.notesEncrypted
      })));
      const removedBorrowerIds = existingBorrowers.map((item) => item.id).filter((borrowerId) => !retainedBorrowerIds.includes(borrowerId));
      if (removedBorrowerIds.length > 0) {
        await transaction.delete(liabilities).where(inArray(liabilities.borrowerId, removedBorrowerIds));
        await transaction.delete(incomeSources).where(inArray(incomeSources.borrowerId, removedBorrowerIds));
        await transaction.delete(employmentRecords).where(inArray(employmentRecords.borrowerId, removedBorrowerIds));
        await transaction.delete(borrowers).where(inArray(borrowers.id, removedBorrowerIds));
      }
      await transaction.update(properties).set({
        propertyType: record.propertyType, propertyTypeOtherDescriptionEncrypted: record.propertyTypeOtherDescriptionEncrypted,
        region: "LEGACY_UNUSED", city: record.propertyCity, addressEncrypted: record.propertyAddressEncrypted,
        estimatedValue: String(record.propertyValue), existingMortgageBalance: "0", updatedAt: new Date()
      }).where(eq(properties.id, property.id));
      await transaction.update(loanRequests).set({
        purpose: record.loanPurpose, requestedAmount: String(record.requestedAmount), requestedTermMonths: 1,
        loanToValue: String(record.propertyValue > 0 ? (record.requestedAmount / record.propertyValue) * 100 : 0), updatedAt: new Date()
      }).where(eq(loanRequests.id, loan.id));
      return client;
    });
  }

  async softDeleteClient(id: number): Promise<void> {
    await db.update(clients).set({deletedAt: new Date(), status: "ARCHIVED", updatedAt: new Date()}).where(eq(clients.id, id));
  }

  async createDocument(values: Omit<DocumentRecord, "id" | "status" | "deletedAt">) {
    const [row] = await db.insert(documents).values(values).returning();
    return row;
  }

  async getDocument(id: number): Promise<DocumentRecord | null> {
    const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return row ?? null;
  }

  async listDocuments(clientId: number): Promise<DocumentRecord[]> {
    return db.select().from(documents).where(and(eq(documents.clientId, clientId), isNull(documents.deletedAt)));
  }

  async updateClientPersonal(id: number, record: ClientPersonalMutationRecord): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const existingBorrowers = await transaction.select({id: borrowers.id}).from(borrowers).where(eq(borrowers.clientId, id));
      const existingIds = new Set(existingBorrowers.map((borrower) => borrower.id));
      if (record.borrowers.length !== existingBorrowers.length || record.borrowers.some((borrower) => !existingIds.has(borrower.id))) return null;
      const primary = record.borrowers[0];
      const [client] = await transaction.update(clients).set({
        firstNameEncrypted: primary.firstNameEncrypted, lastNameEncrypted: primary.lastNameEncrypted,
        identityNumberEncrypted: primary.identityNumberEncrypted, phoneEncrypted: primary.phoneEncrypted,
        emailEncrypted: primary.emailEncrypted, addressEncrypted: primary.addressEncrypted,
        maritalStatus: primary.maritalStatus, numberOfChildren: primary.numberOfChildren, childrenAges: primary.childrenAges,
        borrowerCount: record.numberOfBorrowers, numberOfBorrowers: record.numberOfBorrowers,
        borrowerRelationship: record.borrowerRelationship,
        borrowerRelationshipOtherEncrypted: record.borrowerRelationshipOtherEncrypted,
        householdChildrenCount: record.householdChildrenCount,
        householdChildrenAges: record.householdChildrenAges,
        updatedAt: new Date()
      }).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      if (!client) return null;
      await transaction.update(borrowers).set({borrowerOrder: sql`${borrowers.borrowerOrder} + 100`, isPrimary: false, updatedAt: new Date()}).where(eq(borrowers.clientId, id));
      for (const borrower of record.borrowers) {
        await transaction.update(borrowers).set({
          borrowerOrder: borrower.borrowerOrder, isPrimary: borrower.isPrimary,
          borrowerType: borrower.isPrimary ? "PRIMARY" : "CO_BORROWER",
          fullNameEncrypted: borrower.fullNameEncrypted, firstNameEncrypted: borrower.firstNameEncrypted,
          lastNameEncrypted: borrower.lastNameEncrypted, identityNumberEncrypted: borrower.identityNumberEncrypted,
          identityNumberHash: borrower.identityNumberHash, birthDateEncrypted: borrower.birthDateEncrypted,
          birthDate: null, phoneEncrypted: borrower.phoneEncrypted, emailEncrypted: borrower.emailEncrypted,
          addressEncrypted: borrower.addressEncrypted, cityEncrypted: borrower.cityEncrypted, streetAddressEncrypted: borrower.streetAddressEncrypted, maritalStatus: borrower.maritalStatus,
          numberOfChildren: borrower.numberOfChildren, childrenAges: borrower.childrenAges, updatedAt: new Date()
        }).where(and(eq(borrowers.id, borrower.id), eq(borrowers.clientId, id)));
      }
      return client;
    });
  }

  async updateClientIncome(id: number, record: ClientIncomeMutationRecord): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const existingBorrowers = await transaction.select({id: borrowers.id}).from(borrowers).where(eq(borrowers.clientId, id));
      const existingIds = new Set(existingBorrowers.map((borrower) => borrower.id));
      if (record.borrowers.length !== existingBorrowers.length || record.borrowers.some((borrower) => !existingIds.has(borrower.id))) return null;
      const existingEmployment = await transaction.select({borrowerId: employmentRecords.borrowerId}).from(employmentRecords).where(inArray(employmentRecords.borrowerId, record.borrowers.map((borrower) => borrower.id)));
      if (existingEmployment.length !== record.borrowers.length) return null;
      for (const borrower of record.borrowers) {
        const values = {
          employmentType: borrower.employmentType, employerNameEncrypted: borrower.employerNameEncrypted,
          jobTitle: borrower.jobTitle, employmentSeniorityYears: borrower.employmentSeniorityYears,
          selfEmployedBusinessTypeEncrypted: borrower.selfEmployedBusinessTypeEncrypted,
          selfEmployedBusinessStartYear: borrower.selfEmployedBusinessStartYear,
          selfEmployedLastAssessedIncome: borrower.selfEmployedLastAssessedIncome === null ? null : String(borrower.selfEmployedLastAssessedIncome),
          selfEmployedAssessmentYear: borrower.selfEmployedAssessmentYear,
          selfEmployedAccountantIncomePreviousYear: borrower.selfEmployedAccountantIncomePreviousYear === null ? null : String(borrower.selfEmployedAccountantIncomePreviousYear),
          selfEmployedAccountantIncomeCurrentYear: borrower.selfEmployedAccountantIncomeCurrentYear === null ? null : String(borrower.selfEmployedAccountantIncomeCurrentYear),
          selfEmployedAccountantMonthsCount: borrower.selfEmployedAccountantMonthsCount,
          monthlyNetIncome: String(borrower.monthlyNetIncome), hasAdditionalIncome: borrower.hasAdditionalIncome,
          additionalIncomeType: borrower.additionalIncomeType,
          additionalIncomeAmount: String(borrower.additionalIncomeAmount),
          additionalIncomeDescriptionEncrypted: borrower.additionalIncomeDescriptionEncrypted, updatedAt: new Date()
        };
        await transaction.update(employmentRecords).set(values).where(eq(employmentRecords.borrowerId, borrower.id));
        await transaction.delete(incomeSources).where(eq(incomeSources.borrowerId, borrower.id));
        if (borrower.additionalIncomes.length > 0) await transaction.insert(incomeSources).values(borrower.additionalIncomes.map((income, index) => ({
          borrowerId: borrower.id, sortOrder: index + 1, sourceType: income.sourceType,
          monthlyAmount: String(income.monthlyAmount), descriptionEncrypted: income.descriptionEncrypted
        })));
      }
      const [client] = await transaction.update(clients).set({updatedAt: new Date()}).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      return client ?? null;
    });
  }

  async updateClientLiabilities(id: number, record: ClientLiabilitiesMutationRecord): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const existingBorrowers = await transaction.select({id: borrowers.id}).from(borrowers).where(eq(borrowers.clientId, id));
      const existingIds = new Set(existingBorrowers.map((borrower) => borrower.id));
      if (record.borrowers.length !== existingBorrowers.length || record.borrowers.some((borrower) => !existingIds.has(borrower.id))) return null;
      await transaction.update(liabilities).set({deletedAt: new Date(), updatedAt: new Date()}).where(and(eq(liabilities.clientId, id), isNull(liabilities.deletedAt)));
      for (const borrower of record.borrowers) {
        if (borrower.liabilities.length > 0) await transaction.insert(liabilities).values(borrower.liabilities.map((liability) => ({
          clientId: id, borrowerId: borrower.id, scope: "BORROWER", liabilityType: liability.liabilityType,
          outstandingBalance: liability.currentBalance === null ? null : String(liability.currentBalance), currentBalance: liability.currentBalance === null ? null : String(liability.currentBalance),
          monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate,
          financialInstitutionEncrypted: liability.financialInstitutionEncrypted,
          otherTypeDescriptionEncrypted: liability.otherTypeDescriptionEncrypted, notesEncrypted: liability.notesEncrypted
        })));
      }
      if (record.householdLiabilities.length > 0) await transaction.insert(liabilities).values(record.householdLiabilities.map((liability) => ({
        clientId: id, borrowerId: null, scope: "HOUSEHOLD", liabilityType: liability.liabilityType,
        outstandingBalance: liability.currentBalance === null ? null : String(liability.currentBalance), currentBalance: liability.currentBalance === null ? null : String(liability.currentBalance),
        monthlyPayment: String(liability.monthlyPayment), endDate: liability.endDate,
        financialInstitutionEncrypted: liability.financialInstitutionEncrypted,
        otherTypeDescriptionEncrypted: liability.otherTypeDescriptionEncrypted, notesEncrypted: liability.notesEncrypted
      })));
      const [client] = await transaction.update(clients).set({updatedAt: new Date()}).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      return client ?? null;
    });
  }

  async updateClientProperty(id: number, record: ClientPropertyMutationRecord): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const [property] = await transaction.select({id: properties.id}).from(properties).where(eq(properties.clientId, id)).limit(1);
      const [loan] = await transaction.select({id: loanRequests.id}).from(loanRequests).where(eq(loanRequests.clientId, id)).limit(1);
      if (!property || !loan) return null;
      await transaction.update(properties).set({
        propertyType: record.propertyType, propertyTypeOtherDescriptionEncrypted: record.propertyTypeOtherDescriptionEncrypted,
        city: record.propertyCity, addressEncrypted: record.propertyAddressEncrypted,
        estimatedValue: String(record.propertyValue), updatedAt: new Date()
      }).where(eq(properties.id, property.id));
      await transaction.update(loanRequests).set({
        purpose: record.loanPurpose, requestedAmount: String(record.requestedAmount),
        loanToValue: String(record.propertyValue > 0 ? (record.requestedAmount / record.propertyValue) * 100 : 0), updatedAt: new Date()
      }).where(eq(loanRequests.id, loan.id));
      const [client] = await transaction.update(clients).set({updatedAt: new Date()}).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      return client ?? null;
    });
  }

  async updateClientDealDetails(id: number, dealDetailsEncrypted: string, updatedByUserId: number): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const [client] = await transaction.update(clients).set({
        notesEncrypted: dealDetailsEncrypted, dealDetailsEncrypted, dealDetailsUpdatedByUserId: updatedByUserId,
        dealDetailsUpdatedAt: new Date(), updatedAt: new Date()
      }).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      return client ?? null;
    });
  }

  async listMissingRequiredDocuments(clientId: number) {
    const [borrowerRows, documentRows] = await Promise.all([
      db.select({id: borrowers.id, borrowerOrder: borrowers.borrowerOrder}).from(borrowers).where(eq(borrowers.clientId, clientId)).orderBy(asc(borrowers.borrowerOrder)),
      db.select({borrowerId: documents.borrowerId, documentType: documents.documentType, status: documents.status, deletedAt: documents.deletedAt})
        .from(documents).where(eq(documents.clientId, clientId))
    ]);
    return listMissingRequiredDocuments(borrowerRows, documentRows);
  }

  async softDeleteDocument(id: number): Promise<void> {
    await db.update(documents).set({deletedAt: new Date(), status: "DELETED", updatedAt: new Date()}).where(eq(documents.id, id));
  }

  async listLenders() {
    return db.select({id: lenders.id, name: lenders.name, contactEmail: sql<string>`coalesce(max(${lenderContacts.email}) filter (where ${lenderContacts.active} = true and ${lenderContacts.deletedAt} is null), ${lenders.contactEmail})`})
      .from(lenders).leftJoin(lenderContacts, eq(lenderContacts.lenderId, lenders.id))
      .where(and(eq(lenders.active, true), isNull(lenders.deletedAt))).groupBy(lenders.id)
      .having(sql`coalesce(max(${lenderContacts.email}) filter (where ${lenderContacts.active} = true and ${lenderContacts.deletedAt} is null), ${lenders.contactEmail}) is not null`);
  }

  async listClientSubmissions(clientId: number) {
    return db.select({
      id: lenderSubmissions.id, lenderId: lenderSubmissions.lenderId, lenderName: lenders.name,
      status: lenderSubmissions.status, updatedAt: lenderSubmissions.updatedAt
    }).from(lenderSubmissions).innerJoin(lenders, eq(lenders.id, lenderSubmissions.lenderId))
      .where(eq(lenderSubmissions.clientId, clientId)).orderBy(desc(lenderSubmissions.updatedAt));
  }

  async getSnapshotSource(clientId: number) {
    const [client] = await db.select({
      publicCaseNumber: clients.publicCaseNumber,
      numberOfBorrowers: clients.numberOfBorrowers,
      borrowerRelationship: clients.borrowerRelationship
    }).from(clients).where(and(eq(clients.id, clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) return null;
    const [property] = await db.select().from(properties).where(eq(properties.clientId, clientId)).limit(1);
    const [loan] = await db.select().from(loanRequests).where(eq(loanRequests.clientId, clientId)).limit(1);
    const employmentRows = await db.select({
      borrowerId: borrowers.id,
      employmentType: employmentRecords.employmentType,
      monthlyNetIncome: employmentRecords.monthlyNetIncome,
      additionalIncomeAmount: employmentRecords.additionalIncomeAmount,
      birthDateEncrypted: borrowers.birthDateEncrypted,
      birthDate: borrowers.birthDate
    })
      .from(employmentRecords).innerJoin(borrowers, eq(borrowers.id, employmentRecords.borrowerId))
      .where(eq(borrowers.clientId, clientId)).orderBy(asc(borrowers.borrowerOrder));
    const additionalIncomeRows = employmentRows.length ? await db.select({borrowerId: incomeSources.borrowerId, monthlyAmount: incomeSources.monthlyAmount})
      .from(incomeSources).where(inArray(incomeSources.borrowerId, employmentRows.map((row) => row.borrowerId))) : [];
    const liabilityRows = await db.select({type: liabilities.liabilityType, balance: liabilities.currentBalance, legacyBalance: liabilities.outstandingBalance, monthly: liabilities.monthlyPayment})
      .from(liabilities).where(and(eq(liabilities.clientId, clientId), isNull(liabilities.deletedAt)));
    if (!property || !loan || employmentRows.length === 0) return null;
    return {
      publicCaseNumber: client.publicCaseNumber, loanPurpose: loan.purpose, propertyType: property.propertyType,
      propertyCity: property.city ?? "", propertyValue: Number(property.estimatedValue), requestedAmount: Number(loan.requestedAmount),
      numberOfBorrowers: client.numberOfBorrowers,
      borrowerRelationship: client.borrowerRelationship,
      employmentTypes: employmentRows.map((employment) => employment.employmentType),
      borrowerBirthDatesEncrypted: employmentRows.map((employment) => employment.birthDateEncrypted),
      borrowerBirthDates: employmentRows.map((employment) => employment.birthDate),
      totalMonthlyIncome: employmentRows.reduce((sum, employment) => {
        const normalized = additionalIncomeRows.filter((income) => income.borrowerId === employment.borrowerId);
        const additional = normalized.length ? normalized.reduce((incomeSum, income) => incomeSum + Number(income.monthlyAmount), 0) : Number(employment.additionalIncomeAmount);
        return sum + Number(employment.monthlyNetIncome) + additional;
      }, 0),
      liabilityCount: liabilityRows.length,
      totalLiabilityBalance: liabilityRows.reduce((sum, liability) => sum + Number(liability.balance ?? liability.legacyBalance), 0),
      totalMonthlyPayments: liabilityRows.reduce((sum, liability) => sum + Number(liability.monthly), 0),
      liabilityTypeBreakdown: liabilityRows.reduce<Record<string, number>>((result, liability) => {
        result[liability.type] = (result[liability.type] ?? 0) + 1;
        return result;
      }, {})
    };
  }

  async hasIncompleteLegacyLiabilities(clientId: number): Promise<boolean> {
    const [row] = await db.select({id: liabilities.id}).from(liabilities)
      .where(and(eq(liabilities.clientId, clientId), eq(liabilities.legacyStatus, "INCOMPLETE_LEGACY"), isNull(liabilities.deletedAt)))
      .limit(1);
    return Boolean(row);
  }

  async createSubmission(values: {clientId: number; lenderId: number; createdByUserId: number; snapshot: AnonymousSubmissionSnapshot; pdfStorageKey: string; tokenHash: string; expiresAt: Date}) {
    return db.transaction(async (transaction) => {
      const [submission] = await transaction.insert(lenderSubmissions).values({
        clientId: values.clientId, lenderId: values.lenderId, createdByUserId: values.createdByUserId,
        status: "PENDING_DELIVERY", anonymousSnapshot: values.snapshot, anonymousPdfStorageKey: values.pdfStorageKey
      }).returning({id: lenderSubmissions.id});
      await transaction.insert(lenderInviteTokens).values({submissionId: submission.id, tokenHash: values.tokenHash, expiresAt: values.expiresAt});
      return submission;
    });
  }

  async revokeSubmissionInvites(submissionId: number): Promise<void> {
    await db.update(lenderInviteTokens).set({revokedAt: new Date()}).where(and(eq(lenderInviteTokens.submissionId, submissionId), isNull(lenderInviteTokens.revokedAt)));
  }

  async markSubmissionSent(submissionId: number, messageId: string, recipient: string): Promise<void> {
    await db.transaction(async (transaction) => {
      await transaction.update(lenderSubmissions).set({status: "SENT", sentAt: new Date(), updatedAt: new Date()}).where(eq(lenderSubmissions.id, submissionId));
      const [submission] = await transaction.select({clientId: lenderSubmissions.clientId}).from(lenderSubmissions).where(eq(lenderSubmissions.id, submissionId)).limit(1);
      if (submission) await transaction.update(clients).set({status: "SUBMITTED", updatedAt: new Date()}).where(eq(clients.id, submission.clientId));
      await transaction.insert(emailLogs).values({submissionId, recipient, messageId, status: "SENT", sentAt: new Date()});
    });
  }

  async markSubmissionDeliveryFailed(submissionId: number, recipient: string, sanitizedError: string): Promise<void> {
    await db.transaction(async (transaction) => {
      await transaction.update(lenderSubmissions).set({status: "DELIVERY_FAILED", updatedAt: new Date()}).where(eq(lenderSubmissions.id, submissionId));
      await transaction.insert(emailLogs).values({submissionId, recipient, status: "FAILED", sanitizedError, failedAt: new Date()});
    });
  }

  async prepareSubmissionRetry(submissionId: number, advisorId: number, tokenHash: string, expiresAt: Date) {
    const [row] = await db.select({recipient: lenders.contactEmail, publicCaseNumber: clients.publicCaseNumber})
      .from(lenderSubmissions).innerJoin(clients, eq(clients.id, lenderSubmissions.clientId))
      .innerJoin(lenders, eq(lenders.id, lenderSubmissions.lenderId))
      .where(and(eq(lenderSubmissions.id, submissionId), eq(clients.advisorId, advisorId))).limit(1);
    if (!row?.recipient) return null;
    const delivery = {recipient: row.recipient, publicCaseNumber: row.publicCaseNumber};
    await db.transaction(async (transaction) => {
      await transaction.update(lenderInviteTokens).set({revokedAt: new Date()})
        .where(and(eq(lenderInviteTokens.submissionId, submissionId), isNull(lenderInviteTokens.revokedAt)));
      await transaction.insert(lenderInviteTokens).values({submissionId, tokenHash, expiresAt});
      await transaction.update(lenderSubmissions).set({status: "PENDING_DELIVERY", updatedAt: new Date()}).where(eq(lenderSubmissions.id, submissionId));
    });
    return delivery;
  }

  async validateInvite(tokenHash: string): Promise<InviteValidation | null> {
    const [row] = await db.select({
      tokenId: lenderInviteTokens.id, submissionId: lenderInviteTokens.submissionId, lenderId: lenderSubmissions.lenderId,
      lenderName: lenders.name, expiresAt: lenderInviteTokens.expiresAt, usedAt: lenderInviteTokens.usedAt, revokedAt: lenderInviteTokens.revokedAt
    }).from(lenderInviteTokens)
      .innerJoin(lenderSubmissions, eq(lenderSubmissions.id, lenderInviteTokens.submissionId))
      .innerJoin(lenders, eq(lenders.id, lenderSubmissions.lenderId))
      .where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    return row ?? null;
  }

  async consumeInvite(tokenId: number, userId: number): Promise<void> {
    await db.update(lenderInviteTokens).set({usedAt: new Date(), usedByUserId: userId}).where(eq(lenderInviteTokens.id, tokenId));
  }

  async getLenderSubmission(submissionId: number) {
    const [row] = await db.select({
      id: lenderSubmissions.id, lenderId: lenderSubmissions.lenderId, clientId: lenderSubmissions.clientId,
      status: lenderSubmissions.status, anonymousSnapshot: lenderSubmissions.anonymousSnapshot
    }).from(lenderSubmissions).where(eq(lenderSubmissions.id, submissionId)).limit(1);
    return row as {id: number; lenderId: number; clientId: number; status: string; anonymousSnapshot: AnonymousSubmissionSnapshot} | undefined ?? null;
  }

  async listLenderSubmissions(lenderId: number) {
    return db.select({id: lenderSubmissions.id, status: lenderSubmissions.status, anonymousSnapshot: lenderSubmissions.anonymousSnapshot})
      .from(lenderSubmissions).where(eq(lenderSubmissions.lenderId, lenderId)).orderBy(desc(lenderSubmissions.createdAt)) as Promise<Array<{id: number; status: string; anonymousSnapshot: AnonymousSubmissionSnapshot}>>;
  }

  async createLenderResponse(submissionId: number, userId: number, responseType: "MESSAGE" | "MORE_INFO_REQUEST" | "INTERESTED" | "DECLINED", message: string) {
    const [row] = await db.insert(lenderResponses).values({submissionId, createdByUserId: userId, responseType, message}).returning({id: lenderResponses.id});
    const status = responseType === "MORE_INFO_REQUEST" ? "MORE_INFO_REQUESTED" : responseType === "DECLINED" ? "DECLINED" : "IN_REVIEW";
    await db.update(lenderSubmissions).set({status, updatedAt: new Date()}).where(eq(lenderSubmissions.id, submissionId));
    return row;
  }

  async createIdentityRequest(submissionId: number, userId: number, reason: string, requestedFields: IdentityField[]) {
    const [row] = await db.insert(identityRevealRequests).values({submissionId, requestedByUserId: userId, reason, requestedFields}).returning({id: identityRevealRequests.id});
    await db.update(lenderSubmissions).set({status: "IDENTITY_REQUESTED", updatedAt: new Date()}).where(eq(lenderSubmissions.id, submissionId));
    return row;
  }

  async listAdvisorIdentityRequests(advisorId: number): Promise<unknown[]> {
    return db.select({
      id: identityRevealRequests.id, clientId: clients.id, lenderName: lenders.name,
      submissionId: identityRevealRequests.submissionId, reason: identityRevealRequests.reason,
      requestedFields: identityRevealRequests.requestedFields, approvedFields: identityRevealRequests.approvedFields,
      status: identityRevealRequests.status, createdAt: identityRevealRequests.createdAt
    }).from(identityRevealRequests)
      .innerJoin(lenderSubmissions, eq(lenderSubmissions.id, identityRevealRequests.submissionId))
      .innerJoin(clients, eq(clients.id, lenderSubmissions.clientId))
      .innerJoin(lenders, eq(lenders.id, lenderSubmissions.lenderId))
      .where(eq(clients.advisorId, advisorId)).orderBy(desc(identityRevealRequests.createdAt));
  }

  async decideIdentityRequest(requestId: number, advisorId: number, userId: number, approvedFields: IdentityField[], approvedDocumentIds: number[], approve: boolean): Promise<boolean> {
    const [request] = await db.select({id: identityRevealRequests.id, submissionId: identityRevealRequests.submissionId, requestedFields: identityRevealRequests.requestedFields})
      .from(identityRevealRequests)
      .innerJoin(lenderSubmissions, eq(lenderSubmissions.id, identityRevealRequests.submissionId))
      .innerJoin(clients, eq(clients.id, lenderSubmissions.clientId))
      .where(and(eq(identityRevealRequests.id, requestId), eq(clients.advisorId, advisorId))).limit(1);
    if (!request) return false;
    const requestedFields = request.requestedFields as IdentityField[];
    const status = !approve || approvedFields.length === 0
      ? "REJECTED"
      : approvedFields.length < requestedFields.length ? "PARTIALLY_APPROVED" : "APPROVED";
    await db.transaction(async (transaction) => {
      await transaction.update(identityRevealRequests).set({approvedFields, approvedDocumentIds, status, decidedByUserId: userId, decidedAt: new Date(), updatedAt: new Date()}).where(eq(identityRevealRequests.id, requestId));
      await transaction.update(lenderSubmissions).set({status: status === "APPROVED" || status === "PARTIALLY_APPROVED" ? "IDENTITY_APPROVED" : "IDENTITY_REJECTED", updatedAt: new Date()}).where(eq(lenderSubmissions.id, request.submissionId));
    });
    return true;
  }

  async getRevealedData(submissionId: number) {
    const [row] = await db.select({clientId: lenderSubmissions.clientId, approvedFields: identityRevealRequests.approvedFields, approvedDocumentIds: identityRevealRequests.approvedDocumentIds})
      .from(identityRevealRequests).innerJoin(lenderSubmissions, eq(lenderSubmissions.id, identityRevealRequests.submissionId))
      .where(and(eq(identityRevealRequests.submissionId, submissionId), inArray(identityRevealRequests.status, ["APPROVED", "PARTIALLY_APPROVED"])))
      .orderBy(desc(identityRevealRequests.decidedAt)).limit(1);
    return row as {clientId: number; approvedFields: IdentityField[]; approvedDocumentIds: number[]} | undefined ?? null;
  }

  async getIdentityData(clientId: number) {
    const [row] = await db.select({
      firstNameEncrypted: borrowers.firstNameEncrypted, lastNameEncrypted: borrowers.lastNameEncrypted,
      phoneEncrypted: borrowers.phoneEncrypted, emailEncrypted: borrowers.emailEncrypted,
      identityNumberEncrypted: borrowers.identityNumberEncrypted, propertyAddressEncrypted: properties.addressEncrypted,
      employerNameEncrypted: employmentRecords.employerNameEncrypted
    }).from(clients)
      .leftJoin(properties, eq(properties.clientId, clients.id))
      .leftJoin(borrowers, eq(borrowers.clientId, clients.id))
      .leftJoin(employmentRecords, eq(employmentRecords.borrowerId, borrowers.id))
      .where(and(eq(clients.id, clientId), eq(borrowers.isPrimary, true))).limit(1);
    if (!row?.firstNameEncrypted || !row.lastNameEncrypted || !row.phoneEncrypted || !row.emailEncrypted || !row.identityNumberEncrypted) return null;
    return {
      firstNameEncrypted: row.firstNameEncrypted,
      lastNameEncrypted: row.lastNameEncrypted,
      phoneEncrypted: row.phoneEncrypted,
      emailEncrypted: row.emailEncrypted,
      identityNumberEncrypted: row.identityNumberEncrypted,
      propertyAddressEncrypted: row.propertyAddressEncrypted,
      employerNameEncrypted: row.employerNameEncrypted
    };
  }

  async getCreditIndication(clientId: number): Promise<CreditIndicationRecord | null> {
    const [row] = await db.select().from(creditIndications).where(eq(creditIndications.clientId, clientId)).limit(1);
    if (!row) return null;
    return {
      bouncedChecks: row.bouncedChecks, bouncedChecksCount: row.bouncedChecksCount,
      bouncedDirectDebits: row.bouncedDirectDebits, bouncedDirectDebitsCount: row.bouncedDirectDebitsCount,
      collectionProceedings: row.collectionProceedings, bankruptcy: row.bankruptcy,
      liens: row.liens, mortgageArrears: row.mortgageArrears
    };
  }

  async upsertCreditIndication(clientId: number, values: CreditIndicationRecord): Promise<CreditIndicationRecord> {
    await db.insert(creditIndications).values({clientId, ...values})
      .onConflictDoUpdate({target: creditIndications.clientId, set: {...values, updatedAt: new Date()}});
    return values;
  }

  async getSettings(category: string) {
    return db.select({key: systemSettings.key, value: systemSettings.value, isSecret: systemSettings.isSecret}).from(systemSettings).where(eq(systemSettings.category, category));
  }

  async setSettings(category: string, values: Record<string, string>, userId: number): Promise<void> {
    await db.transaction(async (transaction) => {
      for (const [key, value] of Object.entries(values)) {
        await transaction.insert(systemSettings).values({key, value, category, updatedByUserId: userId})
          .onConflictDoUpdate({target: systemSettings.key, set: {value, category, updatedByUserId: userId, updatedAt: new Date()}});
      }
    });
  }

  async addEmailLog(values: {recipient: string; template?: string; userId?: number; requestId?: string; messageId?: string; status: "SENT" | "FAILED"; sanitizedError?: string}): Promise<void> {
    await db.insert(emailLogs).values({
      recipient: values.recipient,
      template: values.template,
      userId: values.userId,
      requestId: values.requestId,
      messageId: values.messageId,
      status: values.status,
      sanitizedError: values.sanitizedError,
      sentAt: values.status === "SENT" ? new Date() : undefined,
      failedAt: values.status === "FAILED" ? new Date() : undefined
    });
  }

  async getLatestEmailLog(userId: number, template: string) {
    const [row] = await db.select({
      recipient: emailLogs.recipient, template: emailLogs.template, messageId: emailLogs.messageId,
      status: emailLogs.status, sentAt: emailLogs.sentAt, failedAt: emailLogs.failedAt, requestId: emailLogs.requestId
    }).from(emailLogs).where(and(eq(emailLogs.userId, userId), eq(emailLogs.template, template)))
      .orderBy(desc(emailLogs.createdAt)).limit(1);
    return row ?? null;
  }

  async listEmailLogs(recipient: string) {
    return db.select({
      recipient: emailLogs.recipient, template: emailLogs.template, messageId: emailLogs.messageId,
      status: emailLogs.status, sentAt: emailLogs.sentAt, failedAt: emailLogs.failedAt, requestId: emailLogs.requestId
    }).from(emailLogs).where(eq(emailLogs.recipient, recipient)).orderBy(desc(emailLogs.createdAt));
  }

  async addAudit(userId: number | null, action: string, entityType: string | null, entityId: number | null, metadata: Record<string, unknown> | null, requestId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await db.insert(auditLogs).values({actorUserId: userId, action, entityType, entityId, metadata, requestId, ipAddress, userAgent});
  }

  async addAiLog(values: {clientId: number; userId: number; model: string; promptCharacters: number; status: string; durationMs?: number; error?: string}): Promise<void> {
    await db.insert(aiAnalysisLogs).values({clientId: values.clientId, requestedByUserId: values.userId, model: values.model, promptCharacters: values.promptCharacters, status: values.status, durationMs: values.durationMs, sanitizedError: values.error});
  }

  async notifyAdvisor(clientId: number, type: string, title: string, body: string): Promise<void> {
    const [advisor] = await db.select({userId: advisorProfiles.userId}).from(clients)
      .innerJoin(advisorProfiles, eq(advisorProfiles.id, clients.advisorId)).where(eq(clients.id, clientId)).limit(1);
    if (advisor) await db.insert(notifications).values({userId: advisor.userId, type, title, body});
  }

  async listNotifications(userId: number): Promise<unknown[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
  }

  async markNotificationRead(id: number, userId: number): Promise<boolean> {
    const [row] = await db.update(notifications).set({readAt: new Date(), updatedAt: new Date()})
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({id: notifications.id});
    return Boolean(row);
  }

  async listRecentEmailLogs(limit: number) {
    return db.select({
      recipient: emailLogs.recipient,
      template: emailLogs.template,
      status: emailLogs.status,
      sanitizedError: emailLogs.sanitizedError,
      requestId: emailLogs.requestId,
      sentAt: emailLogs.sentAt,
      failedAt: emailLogs.failedAt,
      createdAt: emailLogs.createdAt,
      attempts: sql<number>`count(*) over (partition by coalesce(${emailLogs.requestId}, ${emailLogs.id}::text))`,
      resent: sql<boolean>`exists(select 1 from email_logs previous where previous.recipient=${emailLogs.recipient} and previous.template is not distinct from ${emailLogs.template} and previous.created_at < ${emailLogs.createdAt})`
    }).from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(Math.max(1, Math.min(limit, 500)));
  }

  async listEmailConfigurations(): Promise<EmailConfigurationRecord[]> {
    return db.select().from(emailConfigurations).orderBy(desc(emailConfigurations.updatedAt)).limit(20);
  }

  async getEmailConfiguration(id: number): Promise<EmailConfigurationRecord | null> {
    const [configuration] = await db.select().from(emailConfigurations).where(eq(emailConfigurations.id, id)).limit(1);
    return configuration ?? null;
  }

  async getActiveEmailConfiguration(): Promise<EmailConfigurationRecord | null> {
    const [configuration] = await db.select().from(emailConfigurations).where(eq(emailConfigurations.status, "ACTIVE")).limit(1);
    return configuration ?? null;
  }

  async createEmailConfiguration(values: CreateEmailConfigurationRecord): Promise<EmailConfigurationRecord> {
    const [configuration] = await db.insert(emailConfigurations).values({
      provider: values.provider,
      host: values.host,
      port: values.port,
      securityMode: values.securityMode,
      username: values.username,
      fromEmail: values.fromEmail,
      fromName: values.fromName,
      replyTo: values.replyTo,
      secretName: values.secretName,
      secretVersion: values.secretVersion,
      previousConfigurationId: values.previousConfigurationId,
      createdByUserId: values.userId,
      updatedByUserId: values.userId
    }).returning();
    return configuration;
  }

  async clearEmailConfigurationPassword(id: number, userId: number): Promise<EmailConfigurationRecord | null> {
    const [configuration] = await db.update(emailConfigurations).set({
      secretName: null,
      secretVersion: null,
      status: "DRAFT",
      lastTestedAt: null,
      lastTestFailureCode: null,
      updatedByUserId: userId,
      updatedAt: new Date()
    }).where(and(eq(emailConfigurations.id, id), inArray(emailConfigurations.status, ["DRAFT", "TESTED", "FAILED"]))).returning();
    return configuration ?? null;
  }

  async markEmailConfigurationTest(id: number, status: "TESTED" | "FAILED", failureCode: string | null, userId: number): Promise<EmailConfigurationRecord | null> {
    const [configuration] = await db.update(emailConfigurations).set({
      status,
      lastTestedAt: new Date(),
      lastTestFailureCode: failureCode,
      updatedByUserId: userId,
      updatedAt: new Date()
    }).where(and(eq(emailConfigurations.id, id), inArray(emailConfigurations.status, ["DRAFT", "TESTED", "FAILED"]))).returning();
    return configuration ?? null;
  }

  async activateEmailConfiguration(id: number, userId: number): Promise<EmailConfigurationRecord | null> {
    return db.transaction(async (transaction) => {
      const [target] = await transaction.select().from(emailConfigurations).where(eq(emailConfigurations.id, id)).limit(1);
      if (!target || target.status !== "TESTED") return null;
      const [active] = await transaction.select().from(emailConfigurations).where(eq(emailConfigurations.status, "ACTIVE")).limit(1);
      if (active) {
        await transaction.update(emailConfigurations).set({status: "SUPERSEDED", supersededAt: new Date(), updatedByUserId: userId, updatedAt: new Date()}).where(eq(emailConfigurations.id, active.id));
      }
      const [activated] = await transaction.update(emailConfigurations).set({
        status: "ACTIVE",
        previousConfigurationId: active?.id ?? target.previousConfigurationId,
        activatedAt: new Date(),
        supersededAt: null,
        updatedByUserId: userId,
        updatedAt: new Date()
      }).where(eq(emailConfigurations.id, id)).returning();
      return activated ?? null;
    });
  }

  async rollbackEmailConfiguration(userId: number): Promise<EmailConfigurationRecord | null> {
    return db.transaction(async (transaction) => {
      const [active] = await transaction.select().from(emailConfigurations).where(eq(emailConfigurations.status, "ACTIVE")).limit(1);
      if (!active?.previousConfigurationId) return null;
      const [previous] = await transaction.select().from(emailConfigurations).where(eq(emailConfigurations.id, active.previousConfigurationId)).limit(1);
      if (!previous) return null;
      await transaction.update(emailConfigurations).set({status: "SUPERSEDED", supersededAt: new Date(), updatedByUserId: userId, updatedAt: new Date()}).where(eq(emailConfigurations.id, active.id));
      const [restored] = await transaction.update(emailConfigurations).set({status: "ACTIVE", supersededAt: null, activatedAt: new Date(), updatedByUserId: userId, updatedAt: new Date()}).where(eq(emailConfigurations.id, previous.id)).returning();
      return restored ?? null;
    });
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    const rows = await db.update(notifications).set({readAt: new Date(), updatedAt: new Date()})
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).returning({id: notifications.id});
    return rows.length;
  }

  async listAuditLogs(limit: number): Promise<unknown[]> {
    return db.select({id: auditLogs.id, actorUserId: auditLogs.actorUserId, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, metadata: auditLogs.metadata, requestId: auditLogs.requestId, createdAt: auditLogs.createdAt})
      .from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(limit, 500));
  }

  async listUserAuditEvents(userId: number, actions: string[]): Promise<Array<{action: string; metadata: Record<string, unknown> | null; createdAt: Date; actorUserId: number | null}>> {
    return db.select({action: auditLogs.action, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorUserId: auditLogs.actorUserId})
      .from(auditLogs).where(and(eq(auditLogs.entityType, "user"), eq(auditLogs.entityId, userId), inArray(auditLogs.action, actions)))
      .orderBy(desc(auditLogs.createdAt)).limit(50) as unknown as Promise<Array<{action: string; metadata: Record<string, unknown> | null; createdAt: Date; actorUserId: number | null}>>;
  }

  async listLegalDocumentVersions(documentType: LegalDocumentType): Promise<LegalDocumentVersionRecord[]> {
    return db.select().from(legalDocumentVersions).where(eq(legalDocumentVersions.documentType, documentType)).orderBy(desc(legalDocumentVersions.versionNumber)) as unknown as Promise<LegalDocumentVersionRecord[]>;
  }

  async getLegalDocumentVersion(id: number): Promise<LegalDocumentVersionRecord | null> {
    const [row] = await db.select().from(legalDocumentVersions).where(eq(legalDocumentVersions.id, id)).limit(1);
    return (row as LegalDocumentVersionRecord) ?? null;
  }

  async getActiveLegalDocumentVersion(documentType: LegalDocumentType): Promise<LegalDocumentVersionRecord | null> {
    const [row] = await db.select().from(legalDocumentVersions).where(and(eq(legalDocumentVersions.documentType, documentType), eq(legalDocumentVersions.status, "PUBLISHED"))).limit(1);
    return (row as LegalDocumentVersionRecord) ?? null;
  }

  async getDraftLegalDocumentVersion(documentType: LegalDocumentType): Promise<LegalDocumentVersionRecord | null> {
    const [row] = await db.select().from(legalDocumentVersions).where(and(eq(legalDocumentVersions.documentType, documentType), eq(legalDocumentVersions.status, "DRAFT"))).limit(1);
    return (row as LegalDocumentVersionRecord) ?? null;
  }

  async createLegalDocumentDraft(documentType: LegalDocumentType, userId: number): Promise<LegalDocumentVersionRecord> {
    const existingDraft = await this.getDraftLegalDocumentVersion(documentType);
    if (existingDraft) return existingDraft;
    const active = await this.getActiveLegalDocumentVersion(documentType);
    const [{value: maxVersion}] = await db.select({value: max(legalDocumentVersions.versionNumber)}).from(legalDocumentVersions).where(eq(legalDocumentVersions.documentType, documentType));
    const versionNumber = (maxVersion ?? 0) + 1;
    const [row] = await db.insert(legalDocumentVersions).values({
      documentType, versionNumber, status: "DRAFT",
      title: active?.title ?? (documentType === "TERMS" ? "תנאי שימוש SynCash" : "מדיניות פרטיות SynCash"),
      content: active?.content ?? "",
      contactEmail: active?.contactEmail ?? null, contactPhone: active?.contactPhone ?? null, contactAddress: active?.contactAddress ?? null,
      effectiveDate: active?.effectiveDate ?? null,
      createdByUserId: userId
    }).returning();
    return row as LegalDocumentVersionRecord;
  }

  async updateLegalDocumentDraft(id: number, values: {title: string; content: string; contactEmail: string | null; contactPhone: string | null; contactAddress: string | null; effectiveDate: string | null}): Promise<LegalDocumentVersionRecord | null> {
    const [row] = await db.update(legalDocumentVersions).set({...values, updatedAt: new Date()})
      .where(and(eq(legalDocumentVersions.id, id), eq(legalDocumentVersions.status, "DRAFT"))).returning();
    return (row as LegalDocumentVersionRecord) ?? null;
  }

  async discardLegalDocumentDraft(id: number): Promise<boolean> {
    const result = await db.delete(legalDocumentVersions).where(and(eq(legalDocumentVersions.id, id), eq(legalDocumentVersions.status, "DRAFT"))).returning({id: legalDocumentVersions.id});
    return result.length > 0;
  }

  async publishLegalDocumentVersion(id: number, userId: number): Promise<LegalDocumentVersionRecord | null> {
    return db.transaction(async (transaction) => {
      const [draft] = await transaction.select().from(legalDocumentVersions).where(and(eq(legalDocumentVersions.id, id), eq(legalDocumentVersions.status, "DRAFT"))).limit(1);
      if (!draft) return null;
      const contentHash = sha256(JSON.stringify({title: draft.title, content: draft.content, contactEmail: draft.contactEmail, contactPhone: draft.contactPhone, contactAddress: draft.contactAddress, effectiveDate: draft.effectiveDate}));
      await transaction.update(legalDocumentVersions).set({status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date()})
        .where(and(eq(legalDocumentVersions.documentType, draft.documentType), eq(legalDocumentVersions.status, "PUBLISHED")));
      const [published] = await transaction.update(legalDocumentVersions).set({status: "PUBLISHED", publishedAt: new Date(), publishedByUserId: userId, contentHash, updatedAt: new Date()})
        .where(eq(legalDocumentVersions.id, id)).returning();
      return published as LegalDocumentVersionRecord;
    });
  }

  async countLegalDocumentAcceptances(versionId: number): Promise<number> {
    const [row] = await db.select({value: sql<number>`count(*)::int`}).from(legalDocumentAcceptances).where(eq(legalDocumentAcceptances.legalDocumentVersionId, versionId));
    return row?.value ?? 0;
  }

  async recordLegalDocumentAcceptance(userId: number, documentType: LegalDocumentType, versionId: number, context: {ip?: string; userAgent?: string}): Promise<void> {
    await db.insert(legalDocumentAcceptances).values({
      userId, documentType, legalDocumentVersionId: versionId,
      ipHash: context.ip ? sha256(context.ip) : null,
      userAgentSummary: context.userAgent ? context.userAgent.slice(0, 255) : null
    }).onConflictDoNothing();
  }

  async listLegalDocumentAcceptancesForUser(userId: number): Promise<Array<{documentType: LegalDocumentType; versionId: number; versionNumber: number; title: string; acceptedAt: Date; contentHash: string | null; status: string}>> {
    return db.select({
      documentType: legalDocumentAcceptances.documentType, versionId: legalDocumentAcceptances.legalDocumentVersionId,
      versionNumber: legalDocumentVersions.versionNumber, title: legalDocumentVersions.title,
      acceptedAt: legalDocumentAcceptances.acceptedAt, contentHash: legalDocumentVersions.contentHash,
      status: legalDocumentVersions.status
    }).from(legalDocumentAcceptances).innerJoin(legalDocumentVersions, eq(legalDocumentVersions.id, legalDocumentAcceptances.legalDocumentVersionId))
      .where(eq(legalDocumentAcceptances.userId, userId)).orderBy(desc(legalDocumentAcceptances.acceptedAt));
  }
}

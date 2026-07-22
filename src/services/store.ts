import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  advisorProfiles,
  aiAnalysisLogs,
  auditLogs,
  borrowers,
  clients,
  documents,
  emailLogs,
  employmentRecords,
  identityRevealRequests,
  lenderInviteTokens,
  lenderResponses,
  lenderSubmissions,
  lenderUsers,
  lenders,
  liabilities,
  loanOffers,
  loanRequests,
  notifications,
  properties,
  systemSettings,
  users
} from "../db/schema.js";
import type { AdvisorAccount, AnonymousSubmissionSnapshot, DatabaseUser, IdentityField, UserStatus } from "../domain/types.js";
import type { AuthorizationDirectory } from "../middleware/auth.js";

export interface ClientMutationRecord {
  firstNameEncrypted: string;
  lastNameEncrypted: string;
  identityNumberEncrypted: string;
  phoneEncrypted: string;
  emailEncrypted: string;
  addressEncrypted: string;
  notesEncrypted: string;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  borrowerCount: number;
  fullNameEncrypted: string;
  birthDate: Date;
  employmentType: string;
  employerNameEncrypted: string;
  jobTitle: string;
  employmentSeniorityYears: number;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescriptionEncrypted: string | null;
  dealType: string;
  propertyType: string;
  propertyTypeOtherDescriptionEncrypted: string | null;
  propertyRegion: string;
  propertyCity: string;
  propertyAddressEncrypted: string;
  propertyValue: number;
  existingMortgageBalance: number;
  requestedAmount: number;
  requestedTermMonths: number;
  monthlyLiabilities: number;
  existingMortgageMonthlyPayment: number;
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
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  borrowerCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientFinancialDetails {
  birthDate: Date | null;
  employmentType: string;
  employerNameEncrypted: string | null;
  jobTitle: string;
  employmentStartDate: Date | null;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescriptionEncrypted: string | null;
  monthlyLiabilities: number;
  existingMortgageMonthlyPayment: number;
  dealType: string;
  propertyType: string;
  propertyRegion: string;
  propertyCity: string;
  propertyAddressEncrypted: string | null;
  propertyTypeOtherDescriptionEncrypted: string | null;
  propertyValue: number;
  existingMortgageBalance: number;
  requestedAmount: number;
  requestedTermMonths: number;
  financingPercentage: number;
  latestSubmissionStatus: string | null;
  offerCount: number;
}

export interface DocumentRecord {
  id: number;
  clientId: number;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
  deletedAt: Date | null;
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
  createAdvisorAccount(values: {firebaseUid: string; email: string; firstName: string; lastName: string; phoneEncrypted: string; businessName: string; businessPhoneEncrypted: string; businessEmail: string}): Promise<AdvisorAccount>;
  activateVerifiedAdvisor(userId: number): Promise<AdvisorAccount | null>;
  recordLogin(userId: number): Promise<void>;
  getAdvisorAccount(userId: number): Promise<AdvisorAccount | null>;
  listAdvisorAccounts(): Promise<AdvisorAccount[]>;
  updateAdvisorProfile(userId: number, values: {firstName: string; lastName: string; phoneEncrypted: string; businessName: string; businessPhoneEncrypted: string}): Promise<AdvisorAccount | null>;
  updateAdvisorStatus(userId: number, status: UserStatus): Promise<AdvisorAccount | null>;
  softDeleteAdvisorAccount(userId: number): Promise<void>;
  listClients(advisorId: number | null, page: number, pageSize: number, search: string): Promise<{items: ClientRecord[]; total: number}>;
  createClient(record: CreateClientRecord): Promise<ClientRecord>;
  getClient(id: number): Promise<ClientRecord | null>;
  getClientDetails(id: number): Promise<ClientFinancialDetails | null>;
  updateClient(id: number, record: ClientMutationRecord): Promise<ClientRecord | null>;
  softDeleteClient(id: number): Promise<void>;
  createDocument(values: Omit<DocumentRecord, "id" | "status" | "deletedAt"> & {uploadedByUserId: number; documentType: string}): Promise<DocumentRecord>;
  getDocument(id: number): Promise<DocumentRecord | null>;
  listDocuments(clientId: number): Promise<DocumentRecord[]>;
  softDeleteDocument(id: number): Promise<void>;
  listLenders(): Promise<Array<{id: number; name: string; contactEmail: string}>>;
  listClientSubmissions(clientId: number): Promise<Array<{id: number; lenderId: number; lenderName: string; status: string; updatedAt: Date}>>;
  getSnapshotSource(clientId: number): Promise<{
    publicCaseNumber: string; dealType: string; propertyType: string; propertyRegion: string; propertyValue: number;
    requestedAmount: number; employmentType: string; totalMonthlyIncome: number; totalMonthlyPayments: number;
    existingMortgageBalance: number; requestedTermMonths: number;
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
  createOffer(values: {submissionId: number; userId: number; amount: number; interestRate: number; termMonths: number; monthlyPayment?: number; conditions?: string; expiresAt?: Date}): Promise<{id: number}>;
  getOfferSubmissionId(id: number): Promise<number | null>;
  updateOffer(id: number, submissionId: number, values: {amount?: number; interestRate?: number; termMonths?: number; conditions?: string}): Promise<boolean>;
  withdrawOffer(id: number, submissionId: number): Promise<boolean>;
  listClientOffers(clientId: number): Promise<unknown[]>;
  getSettings(category: string): Promise<Array<{key: string; value: string | null; isSecret: boolean}>>;
  setSettings(category: string, values: Record<string, string>, userId: number): Promise<void>;
  addEmailLog(values: {recipient: string; template?: string; userId?: number; requestId?: string; messageId?: string; status: "SENT" | "FAILED"; sanitizedError?: string}): Promise<void>;
  getLatestEmailLog(userId: number, template: string): Promise<{recipient: string; template: string | null; messageId: string | null; status: string; sentAt: Date | null; failedAt: Date | null; requestId: string | null} | null>;
  listEmailLogs(recipient: string): Promise<Array<{recipient: string; template: string | null; messageId: string | null; status: string; sentAt: Date | null; failedAt: Date | null; requestId: string | null}>>;
  addAudit(userId: number | null, action: string, entityType: string | null, entityId: number | null, metadata: Record<string, unknown> | null, requestId?: string, ipAddress?: string, userAgent?: string): Promise<void>;
  addAiLog(values: {clientId: number; userId: number; model: string; promptCharacters: number; status: string; durationMs?: number; error?: string}): Promise<void>;
  notifyAdvisor(clientId: number, type: string, title: string, body: string): Promise<void>;
  listNotifications(userId: number): Promise<unknown[]>;
  markNotificationRead(id: number, userId: number): Promise<boolean>;
  listAuditLogs(limit: number): Promise<unknown[]>;
}

export class PostgresStore implements AppStore {
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

  async getAdvisorAccount(userId: number): Promise<AdvisorAccount | null> {
    const [row] = await db.select({
      id: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName,
      phoneEncrypted: users.phoneEncrypted, role: users.role, roleLabel: users.roleLabel, status: users.status,
      emailVerified: users.emailVerified, deletedAt: users.deletedAt, advisorId: advisorProfiles.id,
      lenderId: sql<number | null>`null`, businessName: advisorProfiles.businessName,
      businessPhoneEncrypted: advisorProfiles.businessPhoneEncrypted, businessEmail: advisorProfiles.businessEmail,
      createdAt: users.createdAt, updatedAt: users.updatedAt, lastLoginAt: users.lastLoginAt
    }).from(users).innerJoin(advisorProfiles, eq(advisorProfiles.userId, users.id))
      .where(and(eq(users.id, userId), eq(users.role, "ADVISOR"), isNull(users.deletedAt))).limit(1);
    return row ?? null;
  }

  async listAdvisorAccounts(): Promise<AdvisorAccount[]> {
    return db.select({
      id: users.id, firebaseUid: users.firebaseUid, email: users.email, firstName: users.firstName, lastName: users.lastName,
      phoneEncrypted: users.phoneEncrypted, role: users.role, roleLabel: users.roleLabel, status: users.status,
      emailVerified: users.emailVerified, deletedAt: users.deletedAt, advisorId: advisorProfiles.id,
      lenderId: sql<number | null>`null`, businessName: advisorProfiles.businessName,
      businessPhoneEncrypted: advisorProfiles.businessPhoneEncrypted, businessEmail: advisorProfiles.businessEmail,
      createdAt: users.createdAt, updatedAt: users.updatedAt, lastLoginAt: users.lastLoginAt
    }).from(users).innerJoin(advisorProfiles, eq(advisorProfiles.userId, users.id))
      .where(and(eq(users.role, "ADVISOR"), isNull(users.deletedAt))).orderBy(desc(users.createdAt));
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
      const [client] = await transaction.insert(clients).values({
        publicCaseNumber: record.publicCaseNumber,
        advisorId: record.advisorId,
        firstNameEncrypted: record.firstNameEncrypted,
        lastNameEncrypted: record.lastNameEncrypted,
        identityNumberEncrypted: record.identityNumberEncrypted,
        phoneEncrypted: record.phoneEncrypted,
        emailEncrypted: record.emailEncrypted,
        addressEncrypted: record.addressEncrypted,
        notesEncrypted: record.notesEncrypted,
        maritalStatus: record.maritalStatus,
        numberOfChildren: record.numberOfChildren,
        childrenAges: record.childrenAges,
        borrowerCount: record.borrowerCount,
        status: record.status
      }).returning();
      const [borrower] = await transaction.insert(borrowers).values({
        clientId: client.id, borrowerType: "PRIMARY", fullNameEncrypted: record.fullNameEncrypted,
        identityNumberEncrypted: record.identityNumberEncrypted, birthDate: record.birthDate
      }).returning();
      await transaction.insert(employmentRecords).values({
        borrowerId: borrower.id, employmentType: record.employmentType,
        employerNameEncrypted: record.employerNameEncrypted, jobTitle: record.jobTitle,
        startDate: new Date(new Date().setFullYear(new Date().getFullYear() - record.employmentSeniorityYears)),
        monthlyNetIncome: String(record.monthlyNetIncome),
        hasAdditionalIncome: record.hasAdditionalIncome, additionalIncomeType: record.additionalIncomeType,
        additionalIncomeAmount: String(record.additionalIncomeAmount),
        additionalIncomeDescriptionEncrypted: record.additionalIncomeDescriptionEncrypted
      });
      await transaction.insert(properties).values({
        clientId: client.id, propertyType: record.propertyType, region: record.propertyRegion, city: record.propertyCity,
        addressEncrypted: record.propertyAddressEncrypted, estimatedValue: String(record.propertyValue),
        existingMortgageBalance: String(record.existingMortgageBalance),
        propertyTypeOtherDescriptionEncrypted: record.propertyTypeOtherDescriptionEncrypted
      });
      await transaction.insert(loanRequests).values({
        clientId: client.id, purpose: record.dealType, requestedAmount: String(record.requestedAmount),
        requestedTermMonths: record.requestedTermMonths,
        loanToValue: String(record.propertyValue > 0 ? (record.requestedAmount / record.propertyValue) * 100 : 0)
      });
      await transaction.insert(liabilities).values([
        {clientId: client.id, liabilityType: "OTHER", outstandingBalance: "0", monthlyPayment: String(record.monthlyLiabilities)},
        {clientId: client.id, liabilityType: "MORTGAGE", outstandingBalance: String(record.existingMortgageBalance), monthlyPayment: String(record.existingMortgageMonthlyPayment)}
      ]);
      return client;
    });
  }

  async getClient(id: number): Promise<ClientRecord | null> {
    const [row] = await db.select().from(clients).where(and(eq(clients.id, id), isNull(clients.deletedAt))).limit(1);
    return row ?? null;
  }

  async getClientDetails(id: number): Promise<ClientFinancialDetails | null> {
    const [employment] = await db.select({
      birthDate: borrowers.birthDate,
      employmentType: employmentRecords.employmentType,
      employerNameEncrypted: employmentRecords.employerNameEncrypted,
      jobTitle: employmentRecords.jobTitle,
      employmentStartDate: employmentRecords.startDate,
      monthlyNetIncome: employmentRecords.monthlyNetIncome,
      hasAdditionalIncome: employmentRecords.hasAdditionalIncome,
      additionalIncomeType: employmentRecords.additionalIncomeType,
      additionalIncomeAmount: employmentRecords.additionalIncomeAmount,
      additionalIncomeDescriptionEncrypted: employmentRecords.additionalIncomeDescriptionEncrypted
    }).from(employmentRecords).innerJoin(borrowers, eq(borrowers.id, employmentRecords.borrowerId))
      .where(eq(borrowers.clientId, id)).limit(1);
    const [property] = await db.select().from(properties).where(eq(properties.clientId, id)).limit(1);
    const [loan] = await db.select().from(loanRequests).where(eq(loanRequests.clientId, id)).limit(1);
    if (!employment || !property || !loan) return null;
    const liabilityRows = await db.select({type: liabilities.liabilityType, monthlyPayment: liabilities.monthlyPayment})
      .from(liabilities).where(eq(liabilities.clientId, id));
    const [latestSubmission] = await db.select({status: lenderSubmissions.status}).from(lenderSubmissions)
      .where(eq(lenderSubmissions.clientId, id)).orderBy(desc(lenderSubmissions.updatedAt)).limit(1);
    const [offersCount] = await db.select({value: sql<number>`count(*)::int`}).from(loanOffers)
      .innerJoin(lenderSubmissions, eq(lenderSubmissions.id, loanOffers.submissionId))
      .where(eq(lenderSubmissions.clientId, id));
    return {
      birthDate: employment.birthDate,
      employmentType: employment.employmentType,
      employerNameEncrypted: employment.employerNameEncrypted,
      jobTitle: employment.jobTitle ?? "",
      employmentStartDate: employment.employmentStartDate,
      monthlyNetIncome: Number(employment.monthlyNetIncome),
      hasAdditionalIncome: employment.hasAdditionalIncome,
      additionalIncomeType: employment.additionalIncomeType,
      additionalIncomeAmount: Number(employment.additionalIncomeAmount),
      additionalIncomeDescriptionEncrypted: employment.additionalIncomeDescriptionEncrypted,
      monthlyLiabilities: liabilityRows.filter((row) => row.type !== "MORTGAGE").reduce((sum, row) => sum + Number(row.monthlyPayment), 0),
      existingMortgageMonthlyPayment: liabilityRows.filter((row) => row.type === "MORTGAGE").reduce((sum, row) => sum + Number(row.monthlyPayment), 0),
      dealType: loan.purpose,
      propertyType: property.propertyType,
      propertyRegion: property.region,
      propertyCity: property.city ?? "",
      propertyAddressEncrypted: property.addressEncrypted,
      propertyTypeOtherDescriptionEncrypted: property.propertyTypeOtherDescriptionEncrypted,
      propertyValue: Number(property.estimatedValue),
      existingMortgageBalance: Number(property.existingMortgageBalance),
      requestedAmount: Number(loan.requestedAmount),
      requestedTermMonths: loan.requestedTermMonths,
      financingPercentage: Number(loan.loanToValue),
      latestSubmissionStatus: latestSubmission?.status ?? null,
      offerCount: offersCount?.value ?? 0
    };
  }

  async updateClient(id: number, record: ClientMutationRecord): Promise<ClientRecord | null> {
    return db.transaction(async (transaction) => {
      const [client] = await transaction.update(clients).set({
        firstNameEncrypted: record.firstNameEncrypted, lastNameEncrypted: record.lastNameEncrypted,
        identityNumberEncrypted: record.identityNumberEncrypted, phoneEncrypted: record.phoneEncrypted,
        emailEncrypted: record.emailEncrypted, addressEncrypted: record.addressEncrypted, notesEncrypted: record.notesEncrypted,
        maritalStatus: record.maritalStatus, numberOfChildren: record.numberOfChildren, childrenAges: record.childrenAges,
        borrowerCount: record.borrowerCount, status: record.status, updatedAt: new Date()
      }).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning();
      if (!client) return null;

      const [borrower] = await transaction.select({id: borrowers.id}).from(borrowers)
        .where(and(eq(borrowers.clientId, id), eq(borrowers.borrowerType, "PRIMARY"))).limit(1);
      const [property] = await transaction.select({id: properties.id}).from(properties).where(eq(properties.clientId, id)).limit(1);
      const [loan] = await transaction.select({id: loanRequests.id}).from(loanRequests).where(eq(loanRequests.clientId, id)).limit(1);
      if (!borrower || !property || !loan) throw new Error("CLIENT_FINANCIAL_DATA_INCOMPLETE");

      await transaction.update(borrowers).set({
        fullNameEncrypted: record.fullNameEncrypted, identityNumberEncrypted: record.identityNumberEncrypted,
        birthDate: record.birthDate, updatedAt: new Date()
      }).where(eq(borrowers.id, borrower.id));
      await transaction.update(employmentRecords).set({
        employmentType: record.employmentType, employerNameEncrypted: record.employerNameEncrypted,
        jobTitle: record.jobTitle, startDate: new Date(new Date().setFullYear(new Date().getFullYear() - record.employmentSeniorityYears)),
        monthlyNetIncome: String(record.monthlyNetIncome), hasAdditionalIncome: record.hasAdditionalIncome,
        additionalIncomeType: record.additionalIncomeType, additionalIncomeAmount: String(record.additionalIncomeAmount),
        additionalIncomeDescriptionEncrypted: record.additionalIncomeDescriptionEncrypted, updatedAt: new Date()
      }).where(eq(employmentRecords.borrowerId, borrower.id));
      await transaction.update(properties).set({
        propertyType: record.propertyType, propertyTypeOtherDescriptionEncrypted: record.propertyTypeOtherDescriptionEncrypted,
        region: record.propertyRegion, city: record.propertyCity, addressEncrypted: record.propertyAddressEncrypted,
        estimatedValue: String(record.propertyValue), existingMortgageBalance: String(record.existingMortgageBalance), updatedAt: new Date()
      }).where(eq(properties.id, property.id));
      await transaction.update(loanRequests).set({
        purpose: record.dealType, requestedAmount: String(record.requestedAmount), requestedTermMonths: record.requestedTermMonths,
        loanToValue: String(record.propertyValue > 0 ? (record.requestedAmount / record.propertyValue) * 100 : 0), updatedAt: new Date()
      }).where(eq(loanRequests.id, loan.id));
      await transaction.delete(liabilities).where(eq(liabilities.clientId, id));
      await transaction.insert(liabilities).values([
        {clientId: id, liabilityType: "OTHER", outstandingBalance: "0", monthlyPayment: String(record.monthlyLiabilities)},
        {clientId: id, liabilityType: "MORTGAGE", outstandingBalance: String(record.existingMortgageBalance), monthlyPayment: String(record.existingMortgageMonthlyPayment)}
      ]);
      return client;
    });
  }

  async softDeleteClient(id: number): Promise<void> {
    await db.update(clients).set({deletedAt: new Date(), status: "ARCHIVED", updatedAt: new Date()}).where(eq(clients.id, id));
  }

  async createDocument(values: Omit<DocumentRecord, "id" | "status" | "deletedAt"> & {uploadedByUserId: number; documentType: string}) {
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

  async softDeleteDocument(id: number): Promise<void> {
    await db.update(documents).set({deletedAt: new Date(), status: "DELETED", updatedAt: new Date()}).where(eq(documents.id, id));
  }

  async listLenders() {
    return db.select({id: lenders.id, name: lenders.name, contactEmail: lenders.contactEmail}).from(lenders).where(eq(lenders.active, true));
  }

  async listClientSubmissions(clientId: number) {
    return db.select({
      id: lenderSubmissions.id, lenderId: lenderSubmissions.lenderId, lenderName: lenders.name,
      status: lenderSubmissions.status, updatedAt: lenderSubmissions.updatedAt
    }).from(lenderSubmissions).innerJoin(lenders, eq(lenders.id, lenderSubmissions.lenderId))
      .where(eq(lenderSubmissions.clientId, clientId)).orderBy(desc(lenderSubmissions.updatedAt));
  }

  async getSnapshotSource(clientId: number) {
    const [client] = await db.select({publicCaseNumber: clients.publicCaseNumber}).from(clients).where(and(eq(clients.id, clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) return null;
    const [property] = await db.select().from(properties).where(eq(properties.clientId, clientId)).limit(1);
    const [loan] = await db.select().from(loanRequests).where(eq(loanRequests.clientId, clientId)).limit(1);
    const [employment] = await db.select({
      employmentType: employmentRecords.employmentType,
      monthlyNetIncome: employmentRecords.monthlyNetIncome,
      additionalIncomeAmount: employmentRecords.additionalIncomeAmount
    })
      .from(employmentRecords).innerJoin(borrowers, eq(borrowers.id, employmentRecords.borrowerId)).where(eq(borrowers.clientId, clientId)).limit(1);
    const [liability] = await db.select({monthly: sql<string>`coalesce(sum(${liabilities.monthlyPayment}), 0)`}).from(liabilities).where(eq(liabilities.clientId, clientId));
    if (!property || !loan || !employment) return null;
    return {
      publicCaseNumber: client.publicCaseNumber, dealType: loan.purpose, propertyType: property.propertyType,
      propertyRegion: property.region, propertyValue: Number(property.estimatedValue), requestedAmount: Number(loan.requestedAmount),
      employmentType: employment.employmentType,
      totalMonthlyIncome: Number(employment.monthlyNetIncome) + Number(employment.additionalIncomeAmount),
      totalMonthlyPayments: Number(liability?.monthly ?? 0), existingMortgageBalance: Number(property.existingMortgageBalance),
      requestedTermMonths: loan.requestedTermMonths
    };
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
    if (!row) return null;
    await db.transaction(async (transaction) => {
      await transaction.update(lenderInviteTokens).set({revokedAt: new Date()})
        .where(and(eq(lenderInviteTokens.submissionId, submissionId), isNull(lenderInviteTokens.revokedAt)));
      await transaction.insert(lenderInviteTokens).values({submissionId, tokenHash, expiresAt});
      await transaction.update(lenderSubmissions).set({status: "PENDING_DELIVERY", updatedAt: new Date()}).where(eq(lenderSubmissions.id, submissionId));
    });
    return row;
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
      firstNameEncrypted: clients.firstNameEncrypted, lastNameEncrypted: clients.lastNameEncrypted,
      phoneEncrypted: clients.phoneEncrypted, emailEncrypted: clients.emailEncrypted,
      identityNumberEncrypted: clients.identityNumberEncrypted, propertyAddressEncrypted: properties.addressEncrypted,
      employerNameEncrypted: employmentRecords.employerNameEncrypted
    }).from(clients)
      .leftJoin(properties, eq(properties.clientId, clients.id))
      .leftJoin(borrowers, eq(borrowers.clientId, clients.id))
      .leftJoin(employmentRecords, eq(employmentRecords.borrowerId, borrowers.id))
      .where(eq(clients.id, clientId)).limit(1);
    return row ?? null;
  }

  async createOffer(values: {submissionId: number; userId: number; amount: number; interestRate: number; termMonths: number; monthlyPayment?: number; conditions?: string; expiresAt?: Date}) {
    const [row] = await db.insert(loanOffers).values({
      submissionId: values.submissionId, lenderUserId: values.userId, amount: String(values.amount),
      interestRate: String(values.interestRate), termMonths: values.termMonths,
      monthlyPayment: values.monthlyPayment === undefined ? undefined : String(values.monthlyPayment),
      conditions: values.conditions, expiresAt: values.expiresAt, status: "SUBMITTED"
    }).returning({id: loanOffers.id});
    await db.update(lenderSubmissions).set({status: "OFFER_RECEIVED", updatedAt: new Date()}).where(eq(lenderSubmissions.id, values.submissionId));
    return row;
  }

  async getOfferSubmissionId(id: number): Promise<number | null> {
    const [row] = await db.select({submissionId: loanOffers.submissionId}).from(loanOffers).where(eq(loanOffers.id, id)).limit(1);
    return row?.submissionId ?? null;
  }

  async updateOffer(id: number, submissionId: number, values: {amount?: number; interestRate?: number; termMonths?: number; conditions?: string}): Promise<boolean> {
    const [row] = await db.update(loanOffers).set({
      amount: values.amount === undefined ? undefined : String(values.amount),
      interestRate: values.interestRate === undefined ? undefined : String(values.interestRate),
      termMonths: values.termMonths, conditions: values.conditions, status: "UPDATED", updatedAt: new Date()
    }).where(and(eq(loanOffers.id, id), eq(loanOffers.submissionId, submissionId))).returning({id: loanOffers.id});
    return Boolean(row);
  }

  async withdrawOffer(id: number, submissionId: number): Promise<boolean> {
    const [row] = await db.update(loanOffers).set({status: "WITHDRAWN", updatedAt: new Date()})
      .where(and(eq(loanOffers.id, id), eq(loanOffers.submissionId, submissionId))).returning({id: loanOffers.id});
    return Boolean(row);
  }

  async listClientOffers(clientId: number): Promise<unknown[]> {
    return db.select({
      id: loanOffers.id, submissionId: loanOffers.submissionId, lenderName: lenders.name, amount: loanOffers.amount,
      interestRate: loanOffers.interestRate, termMonths: loanOffers.termMonths, monthlyPayment: loanOffers.monthlyPayment,
      conditions: loanOffers.conditions, status: loanOffers.status, expiresAt: loanOffers.expiresAt, updatedAt: loanOffers.updatedAt
    }).from(loanOffers).innerJoin(lenderSubmissions, eq(lenderSubmissions.id, loanOffers.submissionId))
      .innerJoin(lenders, eq(lenders.id, lenderSubmissions.lenderId)).where(eq(lenderSubmissions.clientId, clientId));
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

  async listAuditLogs(limit: number): Promise<unknown[]> {
    return db.select({id: auditLogs.id, actorUserId: auditLogs.actorUserId, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, metadata: auditLogs.metadata, requestId: auditLogs.requestId, createdAt: auditLogs.createdAt})
      .from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(limit, 500));
  }
}

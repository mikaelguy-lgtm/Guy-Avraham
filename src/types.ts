export type UserRole = "SUPER_ADMIN" | "ADMIN" | "ADVISOR" | "LENDER_ADMIN" | "LENDER_UNDERWRITER";

export interface CurrentUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roleLabel: string;
  status: string;
  emailVerified: boolean;
  phone: string;
  businessName: string;
  advisorId: number | null;
  lenderId: number | null;
}

export interface AdvisorAdminRecord extends CurrentUser {
  businessEmail: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  archivedAt: string | null;
}

export interface UserAuditEvent {
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUserId: number | null;
}

export type LegalDocumentType = "TERMS" | "PRIVACY";

export interface LegalDocumentVersion {
  id: number;
  documentType: LegalDocumentType;
  versionNumber: number;
  title: string;
  content: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  effectiveDate: string | null;
  publishedAt: string | null;
}

export interface AdminLegalDocumentVersion extends LegalDocumentVersion {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  contentHash: string | null;
  createdByUserId: number;
  publishedByUserId: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  acceptanceCount?: number;
}

export interface AdminLegalDocumentOverview {
  documentType: LegalDocumentType;
  active: AdminLegalDocumentVersion | null;
  draft: AdminLegalDocumentVersion | null;
}

export interface LegalDocumentAcceptanceRecord {
  documentType: LegalDocumentType;
  versionId: number;
  versionNumber: number;
  title: string;
  acceptedAt: string;
  contentHash: string | null;
  status: string;
}

export interface AdvisorProfile {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber: string;
  isAdmin: boolean;
  status: string;
  disableGemini?: boolean;
}

export interface AdminEmailLogRecord {
  recipientMasked: string;
  template: string | null;
  status: string;
  sanitizedError: string | null;
  requestId: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  attempts: number;
  resent: boolean;
}

export interface ClientBorrower {
  id: number;
  borrowerOrder: number;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  identityNumber: string;
  birthDate: string;
  age: number | null;
  calculatedAge: number | null;
  phone: string;
  email: string;
  address: string;
  city: string | null;
  streetAddress: string | null;
  maritalStatus: string;
  children: {numberOfChildren: number; childrenAges: number[]};
  employment: {
    employmentType: string; employerName: string; jobTitle: string; employmentSeniorityYears: number;
    selfEmployed: {
      businessType: string | null; businessStartYear: number | null; lastAssessedIncome: number | null;
      assessmentYear: number | null; accountantIncomePreviousYear: number | null; accountantIncomeCurrentYear: number | null;
      accountantMonthsCount: number | null;
    } | null;
  };
  income: {monthlyNetIncome: number; hasAdditionalIncome: boolean; additionalIncomeType: string | null; additionalIncomeAmount: number; additionalIncomeDescription: string | null; additionalIncomes: ClientAdditionalIncome[]};
  liabilities: ClientLiability[];
}

export interface ClientAdditionalIncome {
  id?: number;
  type: string;
  monthlyAmount: number;
  description: string | null;
}

export interface ClientLiability {
  id: number;
  scope: "BORROWER" | "HOUSEHOLD";
  type: "LOAN" | "MORTGAGE" | "ALIMONY" | "RENT" | "OTHER_FINANCIAL_ENTITY";
  otherTypeDescription: string | null;
  financialInstitution: string | null;
  currentBalance: number | null;
  monthlyPayment: number;
  endDate: string | null;
  notes: string;
  incompleteLegacy: boolean;
}

export interface MissingRequiredDocument {
  documentType: string;
  borrowerId: number | null;
  borrowerOrder: number | null;
  label: string;
}

export interface CreditIndication {
  bouncedChecks: boolean | null;
  bouncedChecksCount: number | null;
  bouncedDirectDebits: boolean | null;
  bouncedDirectDebitsCount: number | null;
  collectionProceedings: boolean | null;
  bankruptcy: boolean | null;
  liens: boolean | null;
  mortgageArrears: boolean | null;
}

export type ExternalCreditIndication = CreditIndication;

export interface Client {
  id: number;
  publicCaseNumber: string;
  advisorId: number;
  status: string;
  firstName: string;
  lastName: string;
  identityNumber: string;
  phone: string;
  email: string;
  address: string;
  dealDetails: string;
  dealDetailsUpdatedAt: string | null;
  dealDetailsUpdatedBy: string;
  birthDate: string;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  borrowerCount: number;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerRelationshipOther: string | null;
  household: {numberOfChildren: number; childrenAges: number[]};
  borrowers: ClientBorrower[];
  householdLiabilities: ClientLiability[];
  creditIndication: CreditIndication | null;
  employmentType: string;
  employerName: string;
  jobTitle: string;
  employmentSeniorityYears: number;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescription: string | null;
  loanPurpose: string;
  propertyType: string;
  propertyTypeOtherDescription: string | null;
  propertyCity: string;
  propertyAddress: string;
  propertyValue: number;
  requestedAmount: number;
  financingPercentage: number;
  latestSubmissionStatus: string | null;
  totalMonthlyIncome: number;
  totalMonthlyPayments: number;
  totalLiabilityBalance: number;
  activeLiabilityCount: number;
  missingRequiredDocuments: MissingRequiredDocument[];
  missingRequiredDocumentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientList {
  items: Client[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentRecord {
  id: number;
  clientId: number;
  borrowerId: number | null;
  customTitle: string | null;
  description: string | null;
  originalFileName: string;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lender { id: number; name: string; contactEmail: string; }

export interface ClientSubmission {
  id: number;
  lenderId: number;
  lenderName: string;
  status: string;
  updatedAt: string;
}

export interface IdentityRequest {
  id: number;
  clientId?: number;
  lenderName?: string;
  submissionId: number;
  reason: string;
  requestedFields: string[];
  approvedFields: string[];
  status: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface DeliveryCompany {
  id: number;
  activeContactCount: number;
}

export interface DeliveryPreview {
  maskedSnapshot: Record<string, unknown>;
  maskedPdfBase64: string;
  pdfRendererVersion: number;
  pdfFontFingerprint: string;
  pdfGeneratedAt: string;
  pdfContentHash: string;
  eligibleCompanyCount: number;
  responseDeadlineAt: string;
  previewConfirmation: string;
}

export interface DeliveryBlocker {
  code: string;
  category: "DOCUMENT" | "FIELD" | "BUSINESS";
  label: string;
  hint: string;
  action: "documents" | "edit";
}

export interface DeliveryPreflight {
  ready: boolean;
  blockers: DeliveryBlocker[];
}

export interface CompanyResponse {
  publicId: string;
  companyId: number;
  companyName: string;
  versionNumber: number;
  deliveryStatus: string;
  decisionStatus: string;
  accessStatus: string;
  sentAt: string;
  responseDeadlineAt: string;
  decisionAt: string | null;
  fullAccessExpiresAt: string | null;
  contactCount: number;
  openedCount: number;
  viewedCount: number;
  downloadedCount: number;
  decisionContact: {name: string; role: string; email: string; phone: string | null} | null;
  lastActionAt: string | null;
  timeline?: Array<{type: string; actorType?: string; metadata?: Record<string, unknown>; createdAt: string; requestId?: string}>;
  publicCaseNumber?: string;
  clientName?: string;
  advisorName?: string;
  maskedSnapshot?: Record<string, unknown>;
  invitations?: Array<{publicId: string; status: string; contactName: string; contactRole: string; recipientMasked: string; createdAt: string; emailSentAt: string | null; emailFailedAt: string | null; lastAttemptAt: string | null; smtpStatus: string; attempts: number; resent: boolean; safeFailureReason: string | null; requestId: string | null; resendEligible: boolean; openedAt: string | null; openCount: number; maskedPdfViewedAt: string | null; maskedPdfDownloadedAt: string | null; reminderOneSentAt: string | null; reminderTwoSentAt: string | null; closedAt: string | null}>;
}

export interface FinancingCompanyContact {
  id: number;
  firstName: string;
  lastName: string;
  roleTitle: string;
  email: string;
  phone: string | null;
  isPrimary: boolean;
  active: boolean;
}

export interface FinancingCompanyAdmin {
  id: number;
  name: string;
  legalName: string | null;
  companyNumber: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  activityAreas: string[];
  active: boolean;
  adminNotes: string | null;
  contacts: FinancingCompanyContact[];
  activeContactCount: number;
  lastSentAt: string | null;
  submissionCount: number;
  interestedCount: number;
  notInterestedCount: number;
  expiredCount: number;
}

export interface BusinessCalendarExceptionRecord {
  id: number;
  date: string;
  type: "HOLIDAY" | "NON_WORKING_DAY" | "FORCED_WORKING_DAY";
  title: string;
  source: string;
}

export interface ExternalReview {
  companyName: string;
  publicCaseNumber: string;
  versionNumber: number;
  sentAt: string;
  responseDeadlineAt: string;
  deliveryStatus: string;
  decisionStatus: string;
  maskedSnapshot: Record<string, unknown>;
  closed: boolean;
  message: string | null;
  csrfToken: string;
}

export interface ExternalAccess {
  companyName: string;
  publicCaseNumber: string;
  versionNumber: number;
  expiresAt: string;
  requiresOtp: boolean;
  authenticated?: boolean;
  csrfToken: string;
}

export interface ExternalPortalCase {
  companyName: string;
  versionNumber: number;
  accessExpiresAt: string;
  snapshot: Record<string, unknown>;
  csrfToken: string;
}

export interface ExternalPortalDocument {
  publicId: string;
  displayName: string;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

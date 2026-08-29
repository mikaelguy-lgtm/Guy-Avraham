export type CalendarExceptionType = "HOLIDAY" | "NON_WORKING_DAY" | "FORCED_WORKING_DAY";

export interface BusinessCalendarException {
  date: string;
  type: CalendarExceptionType;
  title: string;
  source: string;
}

export interface FullCaseSelfEmployedSnapshot {
  businessType: string | null;
  businessStartYear: number | null;
  lastAssessedIncome: number | null;
  assessmentYear: number | null;
  accountantIncomePreviousYear: number | null;
  accountantIncomeCurrentYear: number | null;
  accountantMonthsCount: number | null;
}

export interface FullCaseBorrowerSnapshot {
  order: number;
  firstName: string;
  lastName: string;
  identityNumber: string;
  dateOfBirth: string;
  age: number | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  streetAddress: string;
  residenceCity: string;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  employment: {
    employmentType: string;
    employerName: string;
    jobTitle: string;
    employmentSeniorityYears: number;
    monthlyNetIncome: number;
    hasAdditionalIncome: boolean;
    additionalIncomeType: string | null;
    additionalIncomeAmount: number;
    additionalIncomeDescription: string | null;
    additionalIncomes?: Array<{type: string; monthlyAmount: number; description: string | null}>;
    selfEmployed: FullCaseSelfEmployedSnapshot | null;
  };
  liabilities: FullCaseLiabilitySnapshot[];
}

export interface CreditIndicationSnapshot {
  bouncedChecks: boolean | null;
  bouncedChecksCount: number | null;
  bouncedDirectDebits: boolean | null;
  bouncedDirectDebitsCount: number | null;
  collectionProceedings: boolean | null;
  bankruptcy: boolean | null;
  liens: boolean | null;
  mortgageArrears: boolean | null;
}

export interface FullCaseLiabilitySnapshot {
  scope: "BORROWER" | "HOUSEHOLD";
  borrowerOrder: number | null;
  type: string;
  otherTypeDescription: string | null;
  financialInstitution?: string | null;
  currentBalance: number | null;
  monthlyPayment: number;
  endDate: string | null;
  notes: string;
  incompleteLegacy?: boolean;
}

export interface VersionDocumentSnapshot {
  documentId: number;
  borrowerId: number | null;
  borrowerOrder: number | null;
  documentType: string;
  customTitle: string | null;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  createdAt: string;
}

export interface FullCaseSnapshot {
  publicCaseNumber: string;
  status?: string;
  sourceClientUpdatedAt: string;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerRelationshipOther?: string | null;
  household: {numberOfChildren: number; childrenAges: number[]};
  borrowers: FullCaseBorrowerSnapshot[];
  householdLiabilities: FullCaseLiabilitySnapshot[];
  property: {propertyType: string; propertyTypeOtherDescription: string | null; city: string; address: string; value: number};
  loanRequest: {purpose: string; requestedAmount: number; requestedTermMonths: number; loanToValue: number};
  dealDetails: string;
  totals: {monthlyIncome: number; liabilityBalance: number; monthlyPayments: number};
  advisor: {fullName: string; businessName: string; phone: string; email: string; website: string | null};
  documents: VersionDocumentSnapshot[];
  creditIndication: CreditIndicationSnapshot | null;
}

export interface MaskedCaseSnapshot {
  publicCaseNumber: string;
  status?: string;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerRelationshipOther?: string | null;
  household: {numberOfChildren: number; childrenAges: number[]};
  borrowers: Array<{
    label: string;
    age: number | null;
    residenceCity: string;
    maritalStatus: string;
    numberOfChildren: number;
    childrenAges: number[];
    employment: Omit<FullCaseBorrowerSnapshot["employment"], "employerName" | "additionalIncomeDescription"> & {additionalIncomeDescription: string | null};
    liabilities: FullCaseLiabilitySnapshot[];
  }>;
  householdLiabilities: FullCaseLiabilitySnapshot[];
  property: {propertyType: string; propertyTypeOtherDescription: string | null; city: string; value: number};
  loanRequest: FullCaseSnapshot["loanRequest"];
  dealDetails: string;
  totals: FullCaseSnapshot["totals"];
  documentStatus: string;
}

export interface RedactionReport {
  categories: string[];
  replacementCount: number;
  warnings: string[];
}

export interface DeliveryCompanySummary {
  id: number;
  activeContactCount: number;
}

export interface DeliveryPreview {
  maskedSnapshot: MaskedCaseSnapshot;
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

export class DeliveryError extends Error {
  constructor(readonly code: string, readonly status: number, readonly publicMessage: string, readonly details?: Record<string, unknown>) {
    super(code);
  }
}

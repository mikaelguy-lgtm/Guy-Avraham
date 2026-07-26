export type CalendarExceptionType = "HOLIDAY" | "NON_WORKING_DAY" | "FORCED_WORKING_DAY";

export interface BusinessCalendarException {
  date: string;
  type: CalendarExceptionType;
  title: string;
  source: string;
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
  };
  liabilities: FullCaseLiabilitySnapshot[];
}

export interface FullCaseLiabilitySnapshot {
  scope: "BORROWER" | "HOUSEHOLD";
  borrowerOrder: number | null;
  type: string;
  otherTypeDescription: string | null;
  currentBalance: number;
  monthlyPayment: number;
  endDate: string | null;
  notes: string;
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
  sourceClientUpdatedAt: string;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  household: {numberOfChildren: number; childrenAges: number[]};
  borrowers: FullCaseBorrowerSnapshot[];
  householdLiabilities: FullCaseLiabilitySnapshot[];
  property: {propertyType: string; propertyTypeOtherDescription: string | null; city: string; address: string; value: number};
  loanRequest: {purpose: string; requestedAmount: number; requestedTermMonths: number; loanToValue: number};
  dealDetails: string;
  totals: {monthlyIncome: number; liabilityBalance: number; monthlyPayments: number};
  advisor: {fullName: string; businessName: string; phone: string; email: string; website: string | null};
  documents: VersionDocumentSnapshot[];
}

export interface MaskedCaseSnapshot {
  publicCaseNumber: string;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
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
  name: string;
  logoUrl: string | null;
  activityAreas: string[];
  activeContactCount: number;
  lastSentAt: string | null;
  alreadySentCurrentVersion: boolean;
}

export interface DeliveryPreview {
  maskedSnapshot: MaskedCaseSnapshot;
  maskedPdfBase64: string;
  companies: DeliveryCompanySummary[];
  selectedCompanyCount: number;
  selectedContactCount: number;
  responseDeadlineAt: string;
  previewConfirmation: string;
}

export class DeliveryError extends Error {
  constructor(readonly code: string, readonly status: number, readonly publicMessage: string, readonly details?: Record<string, unknown>) {
    super(code);
  }
}

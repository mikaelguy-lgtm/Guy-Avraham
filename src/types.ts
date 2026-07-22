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
  notes: string;
  birthDate: string;
  maritalStatus: string;
  numberOfChildren: number;
  childrenAges: number[];
  borrowerCount: number;
  employmentType: string;
  employerName: string;
  jobTitle: string;
  employmentSeniorityYears: number;
  monthlyNetIncome: number;
  hasAdditionalIncome: boolean;
  additionalIncomeType: string | null;
  additionalIncomeAmount: number;
  additionalIncomeDescription: string | null;
  monthlyLiabilities: number;
  existingMortgageMonthlyPayment: number;
  dealType: string;
  propertyType: string;
  propertyTypeOtherDescription: string | null;
  propertyRegion: string;
  propertyCity: string;
  propertyAddress: string;
  propertyValue: number;
  existingMortgageBalance: number;
  requestedAmount: number;
  requestedTermMonths: number;
  financingPercentage: number;
  latestSubmissionStatus: string | null;
  offerCount: number;
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

export interface LoanOffer {
  id: number;
  submissionId: number;
  lenderName: string;
  amount: string;
  interestRate: string;
  termMonths: number;
  monthlyPayment: string | null;
  conditions: string | null;
  status: string;
  expiresAt: string | null;
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

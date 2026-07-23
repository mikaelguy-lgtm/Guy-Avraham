export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "ADVISOR", "LENDER_ADMIN", "LENDER_UNDERWRITER"] as const;
export type UserRole = typeof USER_ROLES[number];
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface DatabaseUser {
  id: number;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roleLabel: string;
  status: UserStatus;
  emailVerified: boolean;
  deletedAt: Date | null;
  advisorId: number | null;
  lenderId: number | null;
}

export interface AdvisorAccount extends DatabaseUser {
  phoneEncrypted: string | null;
  businessName: string | null;
  businessPhoneEncrypted: string | null;
  businessEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface AnonymousSubmissionSnapshot {
  publicCaseNumber: string;
  dealType: string;
  propertyType: string;
  propertyRegion: string;
  propertyValue: number;
  requestedAmount: number;
  financingPercentage: number;
  numberOfBorrowers: number;
  borrowerRelationship: "COUPLE" | "FAMILY" | "PARTNERS" | "OTHER" | null;
  borrowerAges: number[];
  employmentTypes: string[];
  totalMonthlyIncome: number;
  totalMonthlyPayments: number;
  existingMortgageBalance: number;
  requestedTermMonths: number;
}

export const IDENTITY_FIELDS = [
  "FULL_NAME",
  "PHONE",
  "EMAIL",
  "IDENTITY_NUMBER",
  "PROPERTY_ADDRESS",
  "EMPLOYER",
  "SPECIFIC_DOCUMENTS"
] as const;
export type IdentityField = typeof IDENTITY_FIELDS[number];

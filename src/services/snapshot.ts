import type { AnonymousSubmissionSnapshot } from "../domain/types.js";

export interface SnapshotSource {
  publicCaseNumber: string;
  loanPurpose: string;
  propertyType: string;
  propertyCity: string;
  propertyValue: number;
  requestedAmount: number;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerAges: number[];
  employmentTypes: string[];
  totalMonthlyIncome: number;
  liabilityCount: number;
  totalLiabilityBalance: number;
  totalMonthlyPayments: number;
  liabilityTypeBreakdown: Record<string, number>;
}

export function buildAnonymousSubmissionSnapshot(source: SnapshotSource): AnonymousSubmissionSnapshot {
  return {
    publicCaseNumber: source.publicCaseNumber,
    loanPurpose: source.loanPurpose,
    propertyType: source.propertyType,
    propertyCity: source.propertyCity,
    propertyValue: source.propertyValue,
    requestedAmount: source.requestedAmount,
    numberOfBorrowers: source.numberOfBorrowers,
    borrowerRelationship: source.borrowerRelationship === "MARRIED" || source.borrowerRelationship === "COMMON_LAW"
      ? "COUPLE"
      : source.borrowerRelationship as "FAMILY" | "PARTNERS" | "OTHER" | null,
    borrowerAges: source.borrowerAges,
    employmentTypes: source.employmentTypes,
    totalMonthlyIncome: source.totalMonthlyIncome,
    liabilityCount: source.liabilityCount,
    totalLiabilityBalance: source.totalLiabilityBalance,
    totalMonthlyPayments: source.totalMonthlyPayments,
    liabilityTypeBreakdown: source.liabilityTypeBreakdown
  };
}

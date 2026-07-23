import type { AnonymousSubmissionSnapshot } from "../domain/types.js";
import { calculateLoanToValue } from "../utils/clientCalculations.js";

export interface SnapshotSource {
  publicCaseNumber: string;
  dealType: string;
  propertyType: string;
  propertyRegion: string;
  propertyValue: number;
  requestedAmount: number;
  numberOfBorrowers: number;
  borrowerRelationship: string | null;
  borrowerAges: number[];
  employmentTypes: string[];
  totalMonthlyIncome: number;
  totalMonthlyPayments: number;
  existingMortgageBalance: number;
  requestedTermMonths: number;
}

export function buildAnonymousSubmissionSnapshot(source: SnapshotSource): AnonymousSubmissionSnapshot {
  const financingPercentage = calculateLoanToValue(source.requestedAmount, source.propertyValue);
  return {
    publicCaseNumber: source.publicCaseNumber,
    dealType: source.dealType,
    propertyType: source.propertyType,
    propertyRegion: source.propertyRegion,
    propertyValue: source.propertyValue,
    requestedAmount: source.requestedAmount,
    financingPercentage,
    numberOfBorrowers: source.numberOfBorrowers,
    borrowerRelationship: source.borrowerRelationship === "MARRIED" || source.borrowerRelationship === "COMMON_LAW"
      ? "COUPLE"
      : source.borrowerRelationship as "FAMILY" | "PARTNERS" | "OTHER" | null,
    borrowerAges: source.borrowerAges,
    employmentTypes: source.employmentTypes,
    totalMonthlyIncome: source.totalMonthlyIncome,
    totalMonthlyPayments: source.totalMonthlyPayments,
    existingMortgageBalance: source.existingMortgageBalance,
    requestedTermMonths: source.requestedTermMonths
  };
}

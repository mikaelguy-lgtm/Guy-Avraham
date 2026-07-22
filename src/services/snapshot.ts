import type { AnonymousSubmissionSnapshot } from "../domain/types.js";
import { calculateLoanToValue } from "../utils/clientCalculations.js";

export interface SnapshotSource {
  publicCaseNumber: string;
  dealType: string;
  propertyType: string;
  propertyRegion: string;
  propertyValue: number;
  requestedAmount: number;
  employmentType: string;
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
    employmentType: source.employmentType,
    totalMonthlyIncome: source.totalMonthlyIncome,
    totalMonthlyPayments: source.totalMonthlyPayments,
    existingMortgageBalance: source.existingMortgageBalance,
    requestedTermMonths: source.requestedTermMonths
  };
}

import type { AnonymousSubmissionSnapshot } from "../domain/types.js";
import { formatBorrowerRelationship, formatCurrency, formatEmploymentType, formatLiabilityType, formatLoanPurpose, formatPropertyType } from "./formatters.js";

export function snapshotDisplayEntries(snapshot: AnonymousSubmissionSnapshot): Array<[string, string]> {
  return [
    ["מספר תיק", snapshot.publicCaseNumber],
    ["מטרת ההלוואה", formatLoanPurpose(snapshot.loanPurpose)],
    ["סוג הנכס", formatPropertyType(snapshot.propertyType)],
    ["עיר", snapshot.propertyCity],
    ["שווי הנכס", formatCurrency(snapshot.propertyValue)],
    ["סכום המימון המבוקש", formatCurrency(snapshot.requestedAmount)],
    ["מספר לווים", String(snapshot.numberOfBorrowers)],
    ["קשר כללי בין הלווים", snapshot.borrowerRelationship === "COUPLE" ? "בני זוג" : formatBorrowerRelationship(snapshot.borrowerRelationship)],
    ["גילי הלווים", snapshot.borrowerAges.join(", ")],
    ["סוגי תעסוקה", snapshot.employmentTypes.map(formatEmploymentType).join(", ")],
    ["סך הכנסה חודשית", formatCurrency(snapshot.totalMonthlyIncome)],
    ["מספר התחייבויות", String(snapshot.liabilityCount)],
    ["סך יתרות התחייבויות", formatCurrency(snapshot.totalLiabilityBalance)],
    ["סך החזרים חודשיים", formatCurrency(snapshot.totalMonthlyPayments)],
    ["חלוקת התחייבויות", Object.entries(snapshot.liabilityTypeBreakdown).map(([type, count]) => `${formatLiabilityType(type)}: ${count}`).join(", ") || "אין התחייבויות"]
  ];
}

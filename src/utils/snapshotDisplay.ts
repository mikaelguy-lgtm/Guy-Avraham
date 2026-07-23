import type { AnonymousSubmissionSnapshot } from "../domain/types.js";
import { formatBorrowerRelationship, formatCurrency, formatDealType, formatEmploymentType, formatPercentage, formatPropertyType, formatRegion } from "./formatters.js";

export function snapshotDisplayEntries(snapshot: AnonymousSubmissionSnapshot): Array<[string, string]> {
  return [
    ["מספר תיק", snapshot.publicCaseNumber],
    ["סוג העסקה", formatDealType(snapshot.dealType)],
    ["סוג הנכס", formatPropertyType(snapshot.propertyType)],
    ["אזור", formatRegion(snapshot.propertyRegion)],
    ["שווי הנכס", formatCurrency(snapshot.propertyValue)],
    ["סכום המימון המבוקש", formatCurrency(snapshot.requestedAmount)],
    ["אחוז מימון", formatPercentage(snapshot.financingPercentage)],
    ["מספר לווים", String(snapshot.numberOfBorrowers)],
    ["קשר כללי בין הלווים", snapshot.borrowerRelationship === "COUPLE" ? "בני זוג" : formatBorrowerRelationship(snapshot.borrowerRelationship)],
    ["גילי הלווים", snapshot.borrowerAges.join(", ")],
    ["סוגי תעסוקה", snapshot.employmentTypes.map(formatEmploymentType).join(", ")],
    ["סך הכנסה חודשית", formatCurrency(snapshot.totalMonthlyIncome)],
    ["סך החזרים חודשיים", formatCurrency(snapshot.totalMonthlyPayments)],
    ["יתרת משכנתה קיימת", formatCurrency(snapshot.existingMortgageBalance)],
    ["תקופת ההלוואה המבוקשת", `${snapshot.requestedTermMonths} חודשים`]
  ];
}

import { describe, expect, it } from "vitest";
import { buildAnonymousSubmissionSnapshot } from "../../src/services/snapshot";

describe("anonymous snapshot", () => {
  it("contains only the explicit multi-borrower financial allowlist", () => {
    const snapshot = buildAnonymousSubmissionSnapshot({
      publicCaseNumber: "SC-123", loanPurpose: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyCity: "תל אביב",
      propertyValue: 2_000_000, requestedAmount: 1_000_000, numberOfBorrowers: 2, borrowerRelationship: "MARRIED",
      borrowerAges: [41, 39], employmentTypes: ["SALARIED", "SELF_EMPLOYED"], totalMonthlyIncome: 35_000,
      liabilityCount: 2, totalLiabilityBalance: 400_000, totalMonthlyPayments: 5_000, liabilityTypeBreakdown: {MORTGAGE: 1, LOAN: 1}
    });
    expect(snapshot.borrowerRelationship).toBe("COUPLE");
    expect(Object.keys(snapshot).sort()).toEqual([
      "borrowerAges", "borrowerRelationship", "employmentTypes", "liabilityCount", "liabilityTypeBreakdown", "loanPurpose",
      "numberOfBorrowers", "propertyCity", "propertyType", "propertyValue", "publicCaseNumber", "requestedAmount",
      "totalLiabilityBalance", "totalMonthlyIncome", "totalMonthlyPayments"
    ].sort());
    expect(JSON.stringify(snapshot)).not.toMatch(/firstName|lastName|email|phone|address|identity|advisorId|clientId|maritalStatus|children|employer|notes|dealDetails|otherTypeDescription/i);
  });
});

import { describe, expect, it } from "vitest";
import { buildAnonymousSubmissionSnapshot } from "../../src/services/snapshot";

describe("anonymous snapshot", () => {
  it("contains only the explicit multi-borrower financial allowlist", () => {
    const snapshot = buildAnonymousSubmissionSnapshot({
      publicCaseNumber: "SC-123", dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyRegion: "CENTER",
      propertyValue: 2_000_000, requestedAmount: 1_000_000, numberOfBorrowers: 2, borrowerRelationship: "MARRIED",
      borrowerAges: [41, 39], employmentTypes: ["SALARIED", "SELF_EMPLOYED"], totalMonthlyIncome: 35_000,
      totalMonthlyPayments: 5_000, existingMortgageBalance: 400_000, requestedTermMonths: 240
    });
    expect(snapshot.financingPercentage).toBe(50);
    expect(snapshot.borrowerRelationship).toBe("COUPLE");
    expect(Object.keys(snapshot).sort()).toEqual([
      "borrowerAges", "borrowerRelationship", "dealType", "employmentTypes", "existingMortgageBalance", "financingPercentage",
      "numberOfBorrowers", "propertyRegion", "propertyType", "propertyValue", "publicCaseNumber", "requestedAmount",
      "requestedTermMonths", "totalMonthlyIncome", "totalMonthlyPayments"
    ].sort());
    expect(JSON.stringify(snapshot)).not.toMatch(/firstName|lastName|email|phone|address|identity|advisorId|clientId|maritalStatus|children|employer|notes/i);
  });
});

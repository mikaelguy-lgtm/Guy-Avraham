import { describe, expect, it } from "vitest";
import { buildAnonymousSubmissionSnapshot } from "../../src/services/snapshot";

describe("anonymous snapshot", () => {
  it("contains only the explicit financial allowlist and calculates LTV", () => {
    const snapshot = buildAnonymousSubmissionSnapshot({
      publicCaseNumber: "SC-123", dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyRegion: "CENTER",
      propertyValue: 2_000_000, requestedAmount: 1_000_000, employmentType: "SALARIED", totalMonthlyIncome: 35_000,
      totalMonthlyPayments: 5_000, existingMortgageBalance: 400_000, requestedTermMonths: 240
    });
    expect(snapshot.financingPercentage).toBe(50);
    expect(Object.keys(snapshot).sort()).toEqual([
      "dealType", "employmentType", "existingMortgageBalance", "financingPercentage", "totalMonthlyIncome",
      "totalMonthlyPayments", "propertyRegion", "propertyType", "propertyValue", "publicCaseNumber",
      "requestedAmount", "requestedTermMonths"
    ].sort());
    expect(JSON.stringify(snapshot)).not.toMatch(/name|email|phone|address|advisorId|clientId|marital|children|employer|notes/i);
  });
});

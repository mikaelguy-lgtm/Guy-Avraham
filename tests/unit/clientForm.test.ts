import { describe, expect, it } from "vitest";
import { emptyBorrowerForm, isSharedHousehold, resizeBorrowers } from "../../src/utils/clientForm";
import { calculateRepaymentRatio, calculateTotalMonthlyIncome, calculateTotalMonthlyPayments } from "../../src/utils/clientCalculations";

describe("dynamic borrower form", () => {
  it("grows and shrinks dynamically while preserving entered borrowers", () => {
    const first = {...emptyBorrowerForm(), firstName: "דנה"};
    const grown = resizeBorrowers([first], "4");
    expect(grown).toHaveLength(4);
    expect(grown[0].firstName).toBe("דנה");
    expect(resizeBorrowers(grown, "2")).toEqual(grown.slice(0, 2));
  });

  it("recognizes married and common-law shared households", () => {
    expect(isSharedHousehold("MARRIED")).toBe(true);
    expect(isSharedHousehold("COMMON_LAW")).toBe(true);
    expect(isSharedHousehold("FAMILY")).toBe(false);
    expect(isSharedHousehold("PARTNERS")).toBe(false);
  });

  it("aggregates income, payments and repayment ratio across borrowers", () => {
    const incomes = [calculateTotalMonthlyIncome(20_000, 2_000), calculateTotalMonthlyIncome(15_000, 0)];
    const payments = [calculateTotalMonthlyPayments(1_500, 3_500), calculateTotalMonthlyPayments(1_000, 0)];
    expect(incomes.reduce((sum, value) => sum + value, 0)).toBe(37_000);
    expect(payments.reduce((sum, value) => sum + value, 0)).toBe(6_000);
    expect(calculateRepaymentRatio(6_000, 37_000)).toBe(16.22);
  });
});

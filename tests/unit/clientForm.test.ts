import { describe, expect, it } from "vitest";
import { applyBorrowerRelationship, emptyBorrowerForm, emptyClientForm, isNonNegativeDecimalInput, isNonNegativeIntegerInput, isSharedHousehold, resizeBorrowers, resizeChildrenAges, validateClientFormSection } from "../../src/utils/clientForm";
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

  it("rejects signs, scientific notation and decimal counts without truncating state", () => {
    const borrowers = [{...emptyBorrowerForm(), firstName: "דנה"}, emptyBorrowerForm()];
    expect(isNonNegativeIntegerInput("0")).toBe(true);
    expect(isNonNegativeIntegerInput("1.5")).toBe(false);
    expect(isNonNegativeIntegerInput("1e3")).toBe(false);
    expect(isNonNegativeIntegerInput("+2")).toBe(false);
    expect(isNonNegativeDecimalInput("0.01")).toBe(true);
    expect(isNonNegativeDecimalInput("-0.01")).toBe(false);
    expect(resizeBorrowers(borrowers, "1e1")).toEqual(borrowers);
    expect(resizeChildrenAges(["4", "8"], "1.5")).toEqual(["4", "8"]);
  });

  it("derives married fields and restores user-entered values when the relationship changes", () => {
    const form = {
      ...emptyClientForm(),
      numberOfBorrowers: "2",
      borrowers: [
        {...emptyBorrowerForm(), address: "רחוב ראשון", maritalStatus: "DIVORCED", liabilities: [{type: "LOAN", otherTypeDescription: "", currentBalance: "0", monthlyPayment: "0", endDate: "2035-01-01", notes: "בדיקה"}]},
        {...emptyBorrowerForm(), address: "רחוב שני", maritalStatus: "SINGLE"}
      ]
    };
    const married = applyBorrowerRelationship(form, "MARRIED");
    expect(married.borrowers.map((item) => item.maritalStatus)).toEqual(["MARRIED", "MARRIED"]);
    expect(married.borrowers[1].address).toBe("רחוב ראשון");
    expect(married.householdLiabilities).toHaveLength(1);
    const restored = applyBorrowerRelationship(married, "PARTNERS");
    expect(restored.borrowers.map((item) => item.maritalStatus)).toEqual(["DIVORCED", "SINGLE"]);
    expect(restored.borrowers[1].address).toBe("רחוב שני");
    expect(restored.borrowers[0].liabilities).toHaveLength(1);
  });

  it("rejects malformed numeric text in frontend validation", () => {
    const form = {...emptyClientForm(), propertyValue: "1e3", requestedAmount: "+100"};
    expect(validateClientFormSection(form, "property")).toEqual(expect.objectContaining({propertyValue: expect.any(String), requestedAmount: expect.any(String)}));
  });

  it("aggregates income, payments and repayment ratio across borrowers", () => {
    const incomes = [calculateTotalMonthlyIncome(20_000, 2_000), calculateTotalMonthlyIncome(15_000, 0)];
    const payments = [calculateTotalMonthlyPayments(1_500, 3_500), calculateTotalMonthlyPayments(1_000, 0)];
    expect(incomes.reduce((sum, value) => sum + value, 0)).toBe(37_000);
    expect(payments.reduce((sum, value) => sum + value, 0)).toBe(6_000);
    expect(calculateRepaymentRatio(6_000, 37_000)).toBe(16.22);
  });
});

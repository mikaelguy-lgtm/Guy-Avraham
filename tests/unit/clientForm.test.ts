import { describe, expect, it } from "vitest";
import { applyBorrowerRelationship, clientIncomePayload, clientLiabilitiesPayload, emptyAdditionalIncomeForm, emptyBorrowerForm, emptyClientForm, employmentTypeOptions, isNonNegativeDecimalInput, isNonNegativeIntegerInput, isSharedHousehold, maritalStatusOptions, resizeBorrowers, resizeChildrenAges, validateClientFormSection } from "../../src/utils/clientForm";
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
        {...emptyBorrowerForm(), streetAddress: "רחוב ראשון", maritalStatus: "DIVORCED", liabilities: [{type: "LOAN", otherTypeDescription: "", currentBalance: "0", monthlyPayment: "0", endDate: "2035-01-01", notes: "בדיקה"}]},
        {...emptyBorrowerForm(), streetAddress: "רחוב שני", maritalStatus: "SINGLE"}
      ]
    };
    const married = applyBorrowerRelationship(form, "MARRIED");
    expect(married.borrowers.map((item) => item.maritalStatus)).toEqual(["MARRIED", "MARRIED"]);
    expect(married.borrowers[1].streetAddress).toBe("רחוב ראשון");
    expect(married.householdLiabilities).toHaveLength(1);
    const restored = applyBorrowerRelationship(married, "PARTNERS");
    expect(restored.borrowers.map((item) => item.maritalStatus)).toEqual(["DIVORCED", "SINGLE"]);
    expect(restored.borrowers[1].streetAddress).toBe("רחוב שני");
    expect(restored.borrowers[0].liabilities).toHaveLength(1);
  });

  it("rejects malformed numeric text in frontend validation", () => {
    const form = {...emptyClientForm(), propertyValue: "1e3", requestedAmount: "+100"};
    expect(validateClientFormSection(form, "property")).toEqual(expect.objectContaining({propertyValue: expect.any(String), requestedAmount: expect.any(String)}));
  });

  it("starts without a blank income row and preserves ordered dynamic incomes", () => {
    const borrower = {...emptyBorrowerForm(), id: 1, additionalIncomes: [
      {...emptyAdditionalIncomeForm(), type: "RENTAL_INCOME", monthlyAmount: "4500"},
      {...emptyAdditionalIncomeForm(), type: "SALARIED", monthlyAmount: "0"}
    ]};
    expect(emptyBorrowerForm().additionalIncomes).toEqual([]);
    const payload = clientIncomePayload({...emptyClientForm(), borrowers: [borrower]}) as {borrowers: Array<{income: {additionalIncomes: unknown[]}}>};
    expect(payload.borrowers[0].income.additionalIncomes).toEqual([
      {type: "RENTAL_INCOME", monthlyAmount: 4500, description: null},
      {type: "SALARIED", monthlyAmount: 0, description: null}
    ]);
  });

  it("omits legacy selections from new-case option lists", () => {
    expect(maritalStatusOptions.map(([value]) => value)).not.toContain("SEPARATED");
    expect(employmentTypeOptions.map(([value]) => value)).not.toContain("GOVERNMENT_EMPLOYEE");
    expect(employmentTypeOptions.map(([value]) => value)).not.toContain("SECURITY_FORCES");
    expect(employmentTypeOptions).toContainEqual(["TORAH_INSTITUTION", "מוסד תורני"]);
    expect(employmentTypeOptions).toContainEqual(["CONTROLLING_SHAREHOLDER", "שכיר בעל שליטה"]);
  });

  it("normalizes recurring expenses and conditionally includes financial institutions", () => {
    const form = {...emptyClientForm(), borrowers: [{...emptyBorrowerForm(), id: 1, liabilities: [
      {type: "RENT", otherTypeDescription: "", financialInstitution: "ערך מוסתר", currentBalance: "500", monthlyPayment: "4000", endDate: "2035-01-01", notes: "שכירות"},
      {type: "LOAN", otherTypeDescription: "", financialInstitution: "בנק לדוגמה", currentBalance: "25000", monthlyPayment: "800", endDate: "2035-01-01", notes: "הלוואה"}
    ]}]};
    const payload = clientLiabilitiesPayload(form) as {borrowers: Array<{liabilities: Array<{financialInstitution: string | null; currentBalance: number | null}>}>};
    expect(payload.borrowers[0].liabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({financialInstitution: null, currentBalance: null}),
      expect.objectContaining({financialInstitution: "בנק לדוגמה", currentBalance: 25000})
    ]));
  });

  it("aggregates income, payments and repayment ratio across borrowers", () => {
    const incomes = [calculateTotalMonthlyIncome(20_000, 2_000), calculateTotalMonthlyIncome(15_000, 0)];
    const payments = [calculateTotalMonthlyPayments(1_500, 3_500), calculateTotalMonthlyPayments(1_000, 0)];
    expect(incomes.reduce((sum, value) => sum + value, 0)).toBe(37_000);
    expect(payments.reduce((sum, value) => sum + value, 0)).toBe(6_000);
    expect(calculateRepaymentRatio(6_000, 37_000)).toBe(16.22);
  });
});

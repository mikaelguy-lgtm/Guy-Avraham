import { describe, expect, it } from "vitest";
import { clientInputSchema } from "../../src/domain/clientValidation";

const borrower = {
  order: 1, isPrimary: true,
  firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15",
  phone: "0501234567", email: "dana@example.com", address: "רחוב הדוגמה 1, תל אביב",
  maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []},
  employment: {employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6},
  income: {monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: null},
  liabilities: {monthlyLiabilities: 1_500, existingMortgageBalance: 400_000, existingMortgageMonthlyPayment: 4_000}
} as const;

const completeInput = {
  numberOfBorrowers: 2, borrowerRelationship: "MARRIED", borrowerRelationshipOther: null,
  household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [borrower, {...borrower, order: 2, isPrimary: false, firstName: "נועם", identityNumber: "987654321", email: "noam@example.com"}],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", region: "CENTER", address: "רחוב הנכס 2, תל אביב", value: 2_000_000},
  loanRequest: {dealType: "SECOND_HAND_PURCHASE", requestedAmount: 1_250_000, requestedTermMonths: 240},
  notes: "תיק מלא לבדיקה", status: "ACTIVE"
} as const;

describe("client input validation", () => {
  it("accepts multiple borrowers and does not define gross income", () => {
    const parsed = clientInputSchema.parse(completeInput);
    expect(parsed.household.childrenAges).toEqual([4, 8]);
    expect(parsed.borrowers).toHaveLength(2);
    expect(JSON.stringify(parsed)).not.toContain("monthlyGrossIncome");
  });

  it("requires one age per shared child", () => {
    expect(() => clientInputSchema.parse({...completeInput, household: {numberOfChildren: 2, childrenAges: [4]}})).toThrow(/גיל עבור כל ילד/);
  });

  it("rejects duplicate identity numbers in one case", () => {
    expect(() => clientInputSchema.parse({...completeInput, borrowers: [borrower, {...borrower, order: 2, isPrimary: false, firstName: "נועם"}]})).toThrow(/כבר קיים בתיק/);
  });

  it("requires additional income details conditionally", () => {
    const invalidBorrower = {...borrower, income: {...borrower.income, additionalIncomeType: null}};
    expect(() => clientInputSchema.parse({...completeInput, borrowers: [invalidBorrower, completeInput.borrowers[1]]})).toThrow(/סוג הכנסה נוספת/);
    const withoutAdditional = {...borrower, income: {monthlyNetIncome: 20_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}};
    expect(clientInputSchema.parse({numberOfBorrowers: 1, borrowerRelationship: null, borrowerRelationshipOther: null, household: {numberOfChildren: 0, childrenAges: []}, borrowers: [{...withoutAdditional, children: {numberOfChildren: 1, childrenAges: [5]}}], property: completeInput.property, loanRequest: completeInput.loanRequest, notes: completeInput.notes}).borrowers[0].income.additionalIncomeAmount).toBe(0);
  });

  it("supports common-law shared children and partner-specific children", () => {
    expect(clientInputSchema.parse({...completeInput, borrowerRelationship: "COMMON_LAW"}).household.numberOfChildren).toBe(2);
    const partners = {
      ...completeInput,
      borrowerRelationship: "PARTNERS" as const,
      household: {numberOfChildren: 0, childrenAges: []},
      borrowers: completeInput.borrowers.map((item, index) => ({...item, children: {numberOfChildren: 1, childrenAges: [index + 4]}}))
    };
    expect(clientInputSchema.parse(partners).borrowers.map((item) => item.children.childrenAges)).toEqual([[4], [5]]);
  });
});

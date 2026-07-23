import { describe, expect, it } from "vitest";
import { clientInputSchema } from "../../src/domain/clientValidation";

const borrower = {
  order: 1, isPrimary: true,
  firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15",
  phone: "0501234567", email: "dana@example.com", address: "רחוב הדוגמה 1, תל אביב",
  maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []},
  employment: {employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6},
  income: {monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: null},
  liabilities: []
} as const;

const completeInput = {
  numberOfBorrowers: 2, borrowerRelationship: "MARRIED", borrowerRelationshipOther: null,
  household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [borrower, {...borrower, order: 2, isPrimary: false, firstName: "נועם", identityNumber: "987654321", email: "noam@example.com"}],
  householdLiabilities: [{type: "MORTGAGE", otherTypeDescription: null, currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "משכנתה קיימת"}],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס 2, תל אביב", value: 2_000_000},
  loanPurpose: "SECOND_HAND_PURCHASE", loanRequest: {requestedAmount: 1_250_000},
  dealDetails: "תיק מלא לבדיקה", status: "ACTIVE"
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
    expect(clientInputSchema.parse({numberOfBorrowers: 1, borrowerRelationship: null, borrowerRelationshipOther: null, household: {numberOfChildren: 0, childrenAges: []}, householdLiabilities: [], borrowers: [{...withoutAdditional, children: {numberOfChildren: 1, childrenAges: [5]}, liabilities: completeInput.householdLiabilities}], property: completeInput.property, loanPurpose: completeInput.loanPurpose, loanRequest: completeInput.loanRequest, dealDetails: completeInput.dealDetails}).borrowers[0].income.additionalIncomeAmount).toBe(0);
  });

  it("supports common-law shared children and partner-specific children", () => {
    expect(clientInputSchema.parse({...completeInput, borrowerRelationship: "COMMON_LAW", householdLiabilities: [], borrowers: completeInput.borrowers.map((item, index) => ({...item, liabilities: index === 0 ? completeInput.householdLiabilities : []}))}).household.numberOfChildren).toBe(2);
    const partners = {
      ...completeInput,
      borrowerRelationship: "PARTNERS" as const,
      household: {numberOfChildren: 0, childrenAges: []},
      householdLiabilities: [],
      borrowers: completeInput.borrowers.map((item, index) => ({...item, children: {numberOfChildren: 1, childrenAges: [index + 4]}, liabilities: index === 0 ? completeInput.householdLiabilities : []}))
    };
    expect(clientInputSchema.parse(partners).borrowers.map((item) => item.children.childrenAges)).toEqual([[4], [5]]);
  });

  it.each(["LOAN", "MORTGAGE", "ALIMONY"])("accepts a complete %s liability", (type) => {
    const payload = {...completeInput, householdLiabilities: [{...completeInput.householdLiabilities[0], type}]};
    expect(clientInputSchema.parse(payload).householdLiabilities[0].type).toBe(type);
  });

  it("requires a description for another financial entity", () => {
    const payload = {...completeInput, householdLiabilities: [{...completeInput.householdLiabilities[0], type: "OTHER_FINANCIAL_ENTITY", otherTypeDescription: null}]};
    expect(() => clientInputSchema.parse(payload)).toThrow(/שם הגוף/);
  });

  it("keeps married liabilities at household scope and partner liabilities separate", () => {
    expect(clientInputSchema.parse(completeInput).borrowers.every((item) => item.liabilities.length === 0)).toBe(true);
    const partners = {...completeInput, borrowerRelationship: "PARTNERS", household: {numberOfChildren: 0, childrenAges: []}, householdLiabilities: [], borrowers: completeInput.borrowers.map((item, index) => ({...item, children: {numberOfChildren: 0, childrenAges: []}, liabilities: [{...completeInput.householdLiabilities[0], notes: `לווה ${index + 1}`}]}))};
    expect(clientInputSchema.parse(partners).borrowers.map((item) => item.liabilities.length)).toEqual([1, 1]);
  });

  it("accepts bridge financing without region or requested term", () => {
    expect(clientInputSchema.parse({...completeInput, loanPurpose: "BRIDGE_FINANCING"}).loanPurpose).toBe("BRIDGE_FINANCING");
  });
});

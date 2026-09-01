import { describe, expect, it } from "vitest";
import { clientIncomeInputSchema, clientLiabilitiesInputSchema, clientPersonalInputSchema, clientPropertyInputSchema } from "../../src/domain/clientValidation";
import { emptyClientForm, hasClientFormChanges } from "../../src/utils/clientForm";

describe("focused client validation", () => {
  it("validates each section independently", () => {
    expect(() => clientPersonalInputSchema.parse({numberOfBorrowers: 1, borrowerRelationship: null, borrowerRelationshipOther: null, household: {numberOfChildren: 0, childrenAges: []}, borrowers: []})).toThrow();
    expect(() => clientIncomeInputSchema.parse({borrowers: [{id: 1, employment: {employmentType: "SALARIED", employerName: "", jobTitle: "מנהלת", employmentSeniorityYears: 2}, income: {monthlyNetIncome: 10_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}}]})).toThrow();
    expect(() => clientLiabilitiesInputSchema.parse({borrowerRelationship: "MARRIED", borrowers: [{id: 1, liabilities: [{type: "LOAN", otherTypeDescription: null, currentBalance: 10, monthlyPayment: 1, endDate: "2035-01-01", notes: "בדיקה"}]}], householdLiabilities: []})).toThrow();
    expect(() => clientPropertyInputSchema.parse({loanPurpose: "SECOND_HAND_PURCHASE", property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב", value: -1}, loanRequest: {requestedAmount: 100}})).toThrow();
    expect(clientPropertyInputSchema.parse({loanPurpose: "SECOND_HAND_PURCHASE", loanPurposeOther: null, property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב", value: 0}, loanRequest: {requestedAmount: 0}}).property.value).toBe(0);
    expect(clientPropertyInputSchema.parse({loanPurpose: "SECOND_HAND_PURCHASE", loanPurposeOther: null, property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: null, value: 0}, loanRequest: {requestedAmount: 0}}).property.address).toBeNull();
  });

  it("detects unsaved changes without mutating the loaded form", () => {
    const form = emptyClientForm();
    expect(hasClientFormChanges(form, form)).toBe(false);
    expect(hasClientFormChanges(form, {...form, propertyCity: "חיפה"})).toBe(true);
  });
});

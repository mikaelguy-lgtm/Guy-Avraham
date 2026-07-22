import { describe, expect, it } from "vitest";
import { clientInputSchema } from "../../src/domain/clientValidation";

const completeInput = {
  firstName: "דנה", lastName: "לוי", identityNumber: "123456789", birthDate: "1985-06-15",
  phone: "0501234567", email: "dana@example.com", address: "רחוב הדוגמה 1, תל אביב",
  maritalStatus: "MARRIED", numberOfChildren: 2, childrenAges: [4, 8], borrowerCount: 2,
  employmentType: "SALARIED", employerName: "חברה בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6,
  monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME",
  additionalIncomeAmount: 2_500, additionalIncomeDescription: null, monthlyLiabilities: 1_500,
  existingMortgageBalance: 400_000, existingMortgageMonthlyPayment: 4_000,
  dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyTypeOtherDescription: null,
  propertyCity: "תל אביב", propertyRegion: "CENTER", propertyAddress: "רחוב הנכס 2, תל אביב",
  propertyValue: 2_000_000, requestedAmount: 1_250_000, requestedTermMonths: 240,
  notes: "תיק מלא לבדיקה", status: "ACTIVE"
} as const;

describe("client input validation", () => {
  it("accepts a complete client and does not define gross income", () => {
    const parsed = clientInputSchema.parse(completeInput);
    expect(parsed.childrenAges).toEqual([4, 8]);
    expect(parsed).not.toHaveProperty("monthlyGrossIncome");
  });

  it("requires one age per child", () => {
    expect(() => clientInputSchema.parse({...completeInput, childrenAges: [4]})).toThrow(/יש להזין גיל עבור כל ילד/);
  });

  it("requires additional income details conditionally", () => {
    expect(() => clientInputSchema.parse({...completeInput, additionalIncomeType: null})).toThrow(/יש לבחור סוג הכנסה נוספת/);
    expect(() => clientInputSchema.parse({...completeInput, additionalIncomeAmount: 0})).toThrow(/גדול מאפס/);
    expect(clientInputSchema.parse({...completeInput, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}).additionalIncomeAmount).toBe(0);
  });
});

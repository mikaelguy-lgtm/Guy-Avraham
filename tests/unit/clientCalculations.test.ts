import { describe, expect, it } from "vitest";
import {
  calculateLoanToValue,
  calculateRepaymentRatio,
  calculateTotalMonthlyIncome,
  calculateTotalMonthlyPayments
} from "../../src/utils/clientCalculations";

describe("client financial calculations", () => {
  it("calculates income, payments, repayment ratio and LTV", () => {
    expect(calculateTotalMonthlyIncome(20_000, 2_500)).toBe(22_500);
    expect(calculateTotalMonthlyPayments(1_500, 4_000)).toBe(5_500);
    expect(calculateRepaymentRatio(5_500, 22_500)).toBe(24.44);
    expect(calculateLoanToValue(1_250_000, 2_000_000)).toBe(62.5);
  });

  it("handles division by zero safely", () => {
    expect(calculateRepaymentRatio(5_000, 0)).toBe(0);
    expect(calculateLoanToValue(1_000_000, 0)).toBe(0);
  });
});

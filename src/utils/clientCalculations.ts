function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundPercentage(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateTotalMonthlyIncome(monthlyNetIncome: number | string, additionalIncomeAmount: number | string): number {
  return safeNumber(monthlyNetIncome) + safeNumber(additionalIncomeAmount);
}

export function calculateTotalMonthlyPayments(monthlyLiabilities: number | string, existingMortgageMonthlyPayment: number | string): number {
  return safeNumber(monthlyLiabilities) + safeNumber(existingMortgageMonthlyPayment);
}

export function calculateRepaymentRatio(totalMonthlyPayments: number | string, totalMonthlyIncome: number | string): number {
  const income = safeNumber(totalMonthlyIncome);
  return income > 0 ? roundPercentage((safeNumber(totalMonthlyPayments) / income) * 100) : 0;
}

export function calculateLoanToValue(requestedAmount: number | string, propertyValue: number | string): number {
  const value = safeNumber(propertyValue);
  return value > 0 ? roundPercentage((safeNumber(requestedAmount) / value) * 100) : 0;
}

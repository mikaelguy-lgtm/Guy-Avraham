import type {FullCaseSnapshot, MaskedCaseSnapshot, RedactionReport} from "../domain/lenderDelivery.js";

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class CaseRedactionService {
  redact(source: FullCaseSnapshot): {maskedSnapshot: MaskedCaseSnapshot; redactionReport: RedactionReport} {
    const exactValues = new Set<string>();
    const categories = new Set<string>();
    for (const borrower of source.borrowers) {
      // City is deliberately NOT included here: it is the one address
      // granularity the masked view intentionally discloses as
      // residenceCity, so it must not self-redact wherever it appears.
      [borrower.firstName, borrower.lastName, `${borrower.firstName} ${borrower.lastName}`, borrower.identityNumber, borrower.phone, borrower.email, borrower.address, borrower.streetAddress, borrower.employment.employerName]
        .map((value) => value.trim()).filter((value) => value.length >= 2).forEach((value) => exactValues.add(value));
    }
    if (source.property.address) exactValues.add(source.property.address.trim());

    let replacementCount = 0;
    const sanitize = (input: string | null): string | null => {
      if (!input) return input;
      let value = input;
      for (const exact of [...exactValues].sort((left, right) => right.length - left.length)) {
        const pattern = new RegExp(escapePattern(exact), "giu");
        value = value.replace(pattern, () => { replacementCount += 1; categories.add("KNOWN_PII"); return "********"; });
      }
      const patterns: Array<[RegExp, string]> = [
        [/\b\d{9}\b/gu, "IDENTITY_NUMBER"],
        [/(?:\+972|0)(?:-?\d){8,9}\b/gu, "PHONE"],
        [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "EMAIL"],
        [/https?:\/\/[^\s]+/giu, "URL"]
      ];
      for (const [pattern, category] of patterns) value = value.replace(pattern, () => { replacementCount += 1; categories.add(category); return "********"; });
      return value;
    };

    const redactLiability = (liability: FullCaseSnapshot["householdLiabilities"][number]) => ({...liability, otherTypeDescription: sanitize(liability.otherTypeDescription), financialInstitution: sanitize(liability.financialInstitution ?? null), notes: sanitize(liability.notes) ?? ""});
    const maskedSnapshot: MaskedCaseSnapshot = {
      publicCaseNumber: source.publicCaseNumber,
      status: source.status,
      numberOfBorrowers: source.numberOfBorrowers,
      borrowerRelationship: source.borrowerRelationship,
      borrowerRelationshipOther: sanitize(source.borrowerRelationshipOther ?? null),
      household: source.household,
      borrowers: source.borrowers.map((borrower) => ({
        label: `לווה ${borrower.order}`,
        age: borrower.age,
        residenceCity: sanitize(borrower.residenceCity) ?? "",
        maritalStatus: borrower.maritalStatus,
        numberOfChildren: borrower.numberOfChildren,
        childrenAges: borrower.childrenAges,
        employment: {
          employmentType: borrower.employment.employmentType,
          jobTitle: borrower.employment.jobTitle,
          employmentSeniorityYears: borrower.employment.employmentSeniorityYears,
          monthlyNetIncome: borrower.employment.monthlyNetIncome,
          hasAdditionalIncome: borrower.employment.hasAdditionalIncome,
          additionalIncomeType: borrower.employment.additionalIncomeType,
          additionalIncomeAmount: borrower.employment.additionalIncomeAmount,
          additionalIncomeDescription: sanitize(borrower.employment.additionalIncomeDescription),
          additionalIncomes: (borrower.employment.additionalIncomes ?? []).map((income) => ({...income, description: sanitize(income.description)})),
          selfEmployed: borrower.employment.selfEmployed ? {...borrower.employment.selfEmployed, businessType: sanitize(borrower.employment.selfEmployed.businessType)} : null
        },
        liabilities: borrower.liabilities.map(redactLiability)
      })),
      householdLiabilities: source.householdLiabilities.map(redactLiability),
      property: {propertyType: source.property.propertyType, propertyTypeOtherDescription: sanitize(source.property.propertyTypeOtherDescription), city: source.property.city, value: source.property.value},
      loanRequest: source.loanRequest,
      dealDetails: sanitize(source.dealDetails) ?? "",
      totals: source.totals,
      documentStatus: "כל מסמכי החובה קיימים בתיק."
    };
    categories.add("FULL_NAME"); categories.add("IDENTITY_NUMBER"); categories.add("CONTACT_DETAILS"); categories.add("FULL_ADDRESS"); categories.add("DATE_OF_BIRTH"); categories.add("EMPLOYER"); categories.add("ADVISOR_DETAILS");
    return {maskedSnapshot, redactionReport: {categories: [...categories].sort(), replacementCount, warnings: []}};
  }
}

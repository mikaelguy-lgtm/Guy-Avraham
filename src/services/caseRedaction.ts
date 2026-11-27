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
    // פרטי היועץ נחשפים רק אחרי "מעוניין" + OTP — לכן גם הם נמחקים מטקסט חופשי בתצוגה הראשונית.
    if (source.advisor) {
      [source.advisor.fullName, source.advisor.businessName, source.advisor.phone, source.advisor.email]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim()).filter((value) => value.length >= 2).forEach((value) => exactValues.add(value));
    }

    let replacementCount = 0;
    const sanitize = (input: string | null): string | null => {
      if (!input) return input;
      let value = input;
      for (const exact of [...exactValues].sort((left, right) => right.length - left.length)) {
        const pattern = new RegExp(escapePattern(exact), "giu");
        value = value.replace(pattern, () => { replacementCount += 1; categories.add("KNOWN_PII"); return "********"; });
      }
      // דפוסים ישראליים נפוצים: ת"ז 8–9 ספרות (גם עם מקף/רווח לפני ספרת הביקורת),
      // טלפון עם רווחים/מקפים או 972 בלי "+", וקישורי www בלי http.
      // מספרים עם פסיקים/נקודות (סכומים כמו 1,250,000) אינם נתפסים.
      const patterns: Array<[RegExp, string]> = [
        [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "EMAIL"],
        [/(?:https?:\/\/|www\.)[^\s]+/giu, "URL"],
        [/(?<!\d|\d[,.])(?:\+?972[-\s]?|0)(?:[-\s]?\d){8,9}(?!\d|[,.]\d)/gu, "PHONE"],
        [/(?<!\d|\d[,.])\d{7,8}[-\s]\d(?!\d|[,.]\d)/gu, "IDENTITY_NUMBER"],
        [/(?<!\d|\d[,.])\d{8,9}(?!\d|[,.]\d)/gu, "IDENTITY_NUMBER"]
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
        housingStatus: borrower.housingStatus,
        housingStatusOther: sanitize(borrower.housingStatusOther),
        maritalStatus: borrower.maritalStatus,
        numberOfChildren: borrower.numberOfChildren,
        childrenAges: borrower.childrenAges,
        employment: {
          employmentType: borrower.employment.employmentType,
          jobTitle: sanitize(borrower.employment.jobTitle) ?? "",
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
      property: {propertyType: source.property.propertyType, propertyTypeOtherDescription: sanitize(source.property.propertyTypeOtherDescription), city: sanitize(source.property.city) ?? "", value: source.property.value},
      loanRequest: {...source.loanRequest, purposeOther: sanitize(source.loanRequest.purposeOther ?? null)},
      dealDetails: sanitize(source.dealDetails) ?? "",
      totals: source.totals,
      documentStatus: "כל מסמכי החובה קיימים בתיק.",
      // חיווי אשראי אינו מידע מזהה — מוצג גם בתצוגה הראשונית, ללא צורך בהצנעה.
      creditIndication: source.creditIndication
    };
    categories.add("FULL_NAME"); categories.add("IDENTITY_NUMBER"); categories.add("CONTACT_DETAILS"); categories.add("FULL_ADDRESS"); categories.add("DATE_OF_BIRTH"); categories.add("EMPLOYER"); categories.add("ADVISOR_DETAILS");
    return {maskedSnapshot, redactionReport: {categories: [...categories].sort(), replacementCount, warnings: []}};
  }
}

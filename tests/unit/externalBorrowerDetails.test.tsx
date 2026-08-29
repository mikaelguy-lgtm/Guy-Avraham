import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {ExternalBorrowerCard, ExternalBorrowersSection, type ExternalBorrowerDetailsModel} from "../../src/components/ExternalBorrowerDetails";

const borrower: ExternalBorrowerDetailsModel = {
  order: 1,
  label: "לווה 1",
  firstName: "דנה",
  lastName: "לוי",
  identityNumber: "123456789",
  dateOfBirth: "1985-06-15",
  age: 41,
  phone: "0501234567",
  email: "very-long-borrower-email-address-for-responsive-verification@syncash.local",
  address: "רחוב סודי 1, תל אביב",
  residenceCity: "תל אביב",
  maritalStatus: "MARRIED",
  numberOfChildren: 2,
  childrenAges: [4, 8],
  employment: {
    employmentType: "SALARIED",
    employerName: "חברה סודית בע״מ",
    jobTitle: "מנהלת כספים",
    employmentSeniorityYears: 6,
    monthlyNetIncome: 20_000,
    hasAdditionalIncome: true,
    additionalIncomeType: "RENTAL_INCOME",
    additionalIncomeAmount: 2_500,
    additionalIncomeDescription: "שכר דירה חודשי"
  },
  liabilities: [{type: "LOAN", currentBalance: 100_000, monthlyPayment: 1_500, endDate: "2030-01-01", notes: "הלוואה אישית"}]
};

describe("ExternalBorrowerDetails", () => {
  it("renders allowed masked fields and never renders full PII or employer data", () => {
    const markup = renderToStaticMarkup(<ExternalBorrowerCard mode="MASKED" borrower={borrower} index={0} borrowerRelationship="MARRIED" household={{numberOfChildren: 2, childrenAges: [4, 8]}} />);
    for (const visible of ["לווה 1", "גיל 41", "תל אביב", "נשואים", "ילד 1: 4", "שכיר", "מנהלת כספים", "20,000", "הלוואה אישית"]) expect(markup).toContain(visible);
    for (const hidden of ["דנה", "לוי", "123456789", "1985-06-15", "0501234567", "very-long-borrower", "רחוב סודי", "חברה סודית"]) expect(markup).not.toContain(hidden);
    expect(markup).not.toMatch(/SALARIED|MARRIED|LOAN|RENTAL_INCOME/u);
  });

  it("renders complete verified borrower details with localized values and a long email", () => {
    const markup = renderToStaticMarkup(<ExternalBorrowerCard mode="FULL" borrower={borrower} index={0} borrowerRelationship="MARRIED" household={{numberOfChildren: 2, childrenAges: [4, 8]}} />);
    for (const visible of ["דנה לוי", "123456789", "15/06/1985", "0501234567", borrower.email!, "רחוב סודי 1", "חברה סודית בע״מ", "22,500"]) expect(markup).toContain(visible);
    expect(markup).not.toMatch(/SALARIED|MARRIED|LOAN|RENTAL_INCOME/u);
    expect(markup).toContain("external-detail-field-wide");
  });

  it("keeps separate borrower liabilities assigned to their borrower", () => {
    const second = {...borrower, order: 2, label: "לווה 2", firstName: "נועם", liabilities: []};
    const markup = renderToStaticMarkup(<ExternalBorrowersSection mode="FULL" title="פרטי הלווים" borrowers={[borrower, second]} borrowerRelationship="PARTNERS" household={{numberOfChildren: 0, childrenAges: []}} />);
    expect(markup.match(/הלוואה אישית/gu)).toHaveLength(1);
    expect(markup.match(/לא קיימות התחייבויות ללווה זה/gu)).toHaveLength(1);
    expect(markup).not.toContain("התחייבויות משותפות למשק הבית");
  });

  it("renders married household liabilities once after all borrower cards", () => {
    const second = {...borrower, order: 2, label: "לווה 2", firstName: "נועם", liabilities: []};
    const markup = renderToStaticMarkup(<ExternalBorrowersSection mode="MASKED" title="פרטי הלווים" borrowers={[borrower, second]} borrowerRelationship="MARRIED" household={{numberOfChildren: 2, childrenAges: [4, 8]}} householdLiabilities={[{type: "MORTGAGE", currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "משותפת"}]} />);
    expect(markup.match(/התחייבויות משותפות למשק הבית/gu)).toHaveLength(1);
    expect(markup.match(/משותפת/gu)).toHaveLength(1);
    expect(markup.indexOf("לווה 2")).toBeLessThan(markup.indexOf("התחייבויות משותפות למשק הבית"));
    expect(markup).toContain("400,000");
    expect(markup).toContain("4,000");
  });

  it("uses explicit Hebrew missing and empty states", () => {
    const markup = renderToStaticMarkup(<ExternalBorrowerCard mode="FULL" borrower={{order: 1, liabilities: [], employment: {hasAdditionalIncome: false}}} index={0} />);
    expect(markup).toContain("לא צוין");
    expect(markup).toContain("לא קיימות התחייבויות ללווה זה");
    expect(markup).toContain("לא");
    expect(markup).not.toMatch(/undefined|null/u);
  });
});

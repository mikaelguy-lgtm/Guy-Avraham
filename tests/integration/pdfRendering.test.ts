import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {describe, expect, it} from "vitest";
import type {MaskedCaseSnapshot} from "../../src/domain/lenderDelivery";
import {createMaskedCasePdf} from "../../src/services/pdf";

const snapshot: MaskedCaseSnapshot = {
  publicCaseNumber: "SC-INTEGRATION-HE", status: "ACTIVE", numberOfBorrowers: 1, borrowerRelationship: null,
  household: {numberOfChildren: 0, childrenAges: []},
  borrowers: [{
    label: "לווה 1", age: 41, residenceCity: "תל אביב", maritalStatus: "MARRIED", numberOfChildren: 0, childrenAges: [],
    employment: {employmentType: "SALARIED", jobTitle: "מנהלת", employmentSeniorityYears: 6, monthlyNetIncome: 20_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null},
    liabilities: []
  }],
  householdLiabilities: [{scope: "HOUSEHOLD", borrowerOrder: null, type: "MORTGAGE", otherTypeDescription: null, financialInstitution: "בנק למשכנתאות", currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "התחייבות פעילה"}],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", value: 2_000_000},
  loanRequest: {purpose: "SECOND_HAND_PURCHASE", requestedAmount: 1_000_000, requestedTermMonths: 240, loanToValue: 50},
  dealDetails: "רכישה יד שנייה במרכז הארץ", totals: {monthlyIncome: 20_000, liabilityBalance: 400_000, monthlyPayments: 4_000},
  documentStatus: "כל מסמכי החובה קיימים בתיק."
};

describe("Hebrew PDF rendering integration", () => {
  it("embeds a Hebrew font with Unicode text and no blank pages", async () => {
    const pdf = await createMaskedCasePdf(snapshot, {versionNumber: 3, createdAt: new Date("2026-07-27T09:00:00.000Z")});
    const raw = pdf.toString("latin1");
    expect(raw).toContain("NotoSansHebrew");
    expect(raw).toContain("/FontFile2");
    expect(raw).toContain("/ToUnicode");
    const document = await getDocument({data: new Uint8Array(pdf)}).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" ").split("\u0000").join("").replace(/\s+/gu, " ").trim());
    }
    const text = pages.join(" ");
    for (const expected of ["תיק מימון מוסווה לבחינה", "תקציר העסקה", "פרטים אישיים", "הכנסות", "התחייבויות", "נכס ובקשת מימון", "פירוט העסקה", "כל מסמכי החובה קיימים בתיק"]) expect(text).toContain(expected);
    expect(text).not.toMatch(/[�□■]/u);
    expect(text).not.toMatch(/SECOND_HAND_PURCHASE|SALARIED|MORTGAGE|APARTMENT/u);
    expect(pages.every((pageText) => pageText.replace(/SYNCASH|מידע סודי|הופק|עמוד|מתוך|\s/gu, "").length > 10)).toBe(true);
    expect(document.numPages).toBeLessThanOrEqual(4);
  });
});

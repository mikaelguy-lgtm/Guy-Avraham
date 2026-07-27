import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import {readFileSync} from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {FullCaseSnapshot} from "../../src/domain/lenderDelivery";
import {CaseRedactionService} from "../../src/services/caseRedaction";
import { createAnonymousPdf, createFullCasePdf, createMaskedCasePdf, formatPdfBidi, formatVisiblePdfText, PDF_RENDERER_VERSION } from "../../src/services/pdf";
import {assertRequiredHebrewGlyphs, loadPdfHebrewFonts, PdfHebrewFontError, REQUIRED_PDF_HEBREW_CHARACTERS} from "../../src/services/pdfFonts";

async function pdfContent(pdf: Buffer) {
  const document = await getDocument({data: new Uint8Array(pdf)}).promise;
  const pages: string[] = [];
  let pathCount = 0;
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    const operators = await page.getOperatorList();
    pathCount += operators.fnArray.filter((operator) => operator === OPS.constructPath).length;
  }
  const text = pages.join(" ");
  return {document, pages, text, normalizedText: text.split("\u0000").join("").replace(/\s+/gu, " ").trim(), pathCount};
}

const fullSnapshot: FullCaseSnapshot = {
  publicCaseNumber: "SC-HEBREW-PDF", status: "ACTIVE", sourceClientUpdatedAt: "2026-07-27T00:00:00.000Z", numberOfBorrowers: 1, borrowerRelationship: null,
  household: {numberOfChildren: 0, childrenAges: []},
  borrowers: [{order: 1, firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15", age: 41, phone: "0501234567", email: "dana@example.com", address: "רחוב סודי 1, תל אביב", residenceCity: "תל אביב", maritalStatus: "SINGLE", numberOfChildren: 0, childrenAges: [], employment: {employmentType: "SALARIED", employerName: "מעסיק סודי בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6, monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: null}, liabilities: [{scope: "BORROWER", borrowerOrder: 1, type: "LOAN", otherTypeDescription: null, currentBalance: 100_000, monthlyPayment: 1_500, endDate: "2030-01-01", notes: "הלוואה פעילה"}]}],
  householdLiabilities: [], property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס 9, תל אביב", value: 2_000_000},
  loanRequest: {purpose: "SECOND_HAND_PURCHASE", requestedAmount: 1_250_000, requestedTermMonths: 240, loanToValue: 62.5}, dealDetails: "רכישת דירה יד שנייה במרכז הארץ", totals: {monthlyIncome: 22_500, liabilityBalance: 100_000, monthlyPayments: 1_500},
  advisor: {fullName: "יועץ פרטי", businessName: "ייעוץ פרטי", phone: "0500000000", email: "advisor@example.com", website: null},
  documents: ["ID_FRONT", "ID_BACK", "ID_APPENDIX", "PROPERTY_RIGHTS", "POWER_OF_ATTORNEY"].map((documentType, index) => ({documentId: index + 1, borrowerId: index < 3 ? 1 : null, borrowerOrder: index < 3 ? 1 : null, documentType, customTitle: null, mimeType: "application/pdf", sizeBytes: 100, checksumSha256: "a".repeat(64), storageKey: `document-${index}`, createdAt: "2026-07-27T00:00:00.000Z"}))
};

describe("anonymous PDF", () => {
  it("loads only bundled Hebrew fonts and verifies every required glyph", () => {
    const fonts = loadPdfHebrewFonts();
    expect(fonts.regular.internalName).toBe("NotoSansHebrew-Regular");
    expect(fonts.bold.internalName).toBe("NotoSansHebrew-Bold");
    expect(fonts.regular.buffer.length).toBeGreaterThan(40_000);
    expect(fonts.bold.buffer.length).toBeGreaterThan(40_000);
    expect(fonts.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(REQUIRED_PDF_HEBREW_CHARACTERS).toContain("₪״׳");
  });

  it("rejects a generic font that has no Hebrew glyph coverage", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let caught: unknown;
    try { assertRequiredHebrewGlyphs({hasGlyphForCodePoint: (codePoint) => codePoint < 128, glyphForCodePoint: (codePoint) => ({id: codePoint < 128 ? codePoint : 0})}, "NotoSans-Regular"); }
    catch (thrown) { caught = thrown; }
    expect(caught).toBeInstanceOf(PdfHebrewFontError);
    expect((caught as PdfHebrewFontError).code).toBe("PDF_HEBREW_FONT_MISSING_GLYPHS");
    expect(error).toHaveBeenCalledWith("PDF Hebrew font validation failed", {code: "PDF_HEBREW_FONT_MISSING_GLYPHS", fontName: "NotoSans-Regular"});
    error.mockRestore();
  });

  it("keeps logical mixed-direction text without manual reversal", () => {
    expect(formatPdfBidi("תיק SC-123 · סכום 1,250,000 ₪")).toContain("תיק SC-123 · סכום 1,250,000 ₪");
    const visual = formatVisiblePdfText("תיק SC-123 · סכום 1,250,000 ₪");
    expect(visual).toContain("SC-123");
    expect(visual).toContain("1,250,000");
    expect(visual).not.toContain("321-CS");
    const source = readFileSync(new URL("../../src/services/pdf.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/split\([^)]*\)\.reverse|reverse\(\)\.join/);
    expect(PDF_RENDERER_VERSION).toBe(3);
  });

  it("is generated only from the anonymous snapshot", async () => {
    const pdf = await createAnonymousPdf({
      publicCaseNumber: "SC-SAFE-123", loanPurpose: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyCity: "תל אביב",
      propertyValue: 2_000_000, requestedAmount: 1_000_000, numberOfBorrowers: 2,
      borrowerRelationship: "COUPLE", borrowerAges: [41, 39], employmentTypes: ["SALARIED", "SELF_EMPLOYED"],
      totalMonthlyIncome: 35_000, liabilityCount: 2, totalLiabilityBalance: 400_000, totalMonthlyPayments: 5_000, liabilityTypeBreakdown: {MORTGAGE: 1, LOAN: 1}
    });
    const {text} = await pdfContent(pdf);
    expect(text).toContain("SC-SAFE-123");
    expect(text).not.toMatch(/Dana|123456789|0500000000|dana@example|Street|Employer|clientId|advisorId|lenderId/);
  });

  it("embeds a Hebrew font and renders branded Hebrew content with a vector logo", async () => {
    const pdf = await createFullCasePdf(fullSnapshot, {versionNumber: 3, createdAt: new Date("2026-07-27T09:00:00Z")});
    const {document, pages, text, normalizedText, pathCount} = await pdfContent(pdf);
    expect(document.numPages).toBeGreaterThan(1);
    expect(document.numPages).toBeLessThanOrEqual(5);
    expect(pages.every((pageText) => pageText.replace(/SYNCASH|מידע סודי|הופק|עמוד|מתוך|\s/g, "").length > 10)).toBe(true);
    for (const expected of ["תיק מימון מלא", "תקציר העסקה", "פרטים אישיים", "הכנסות", "התחייבויות", "נכס ובקשת מימון", "פירוט העסקה", "כל מסמכי החובה קיימים בתיק"]) expect(normalizedText).toContain(expected);
    expect(text.replace(/\s/g, "")).toContain("SYNCASH");
    expect(text).not.toMatch(/[�□■]/u);
    expect(pathCount).toBeGreaterThan(20);
    expect(pdf.toString("latin1")).toContain("/FontFile2");
    expect(pdf.toString("latin1")).toContain("NotoSansHebrew");
  });

  it("keeps masked fields hidden while preserving readable Hebrew business data", async () => {
    const masked = new CaseRedactionService().redact(fullSnapshot).maskedSnapshot;
    const metadata = {versionNumber: 1, createdAt: new Date("2026-07-27T09:00:00Z")};
    const pdf = await createMaskedCasePdf(masked, metadata);
    expect(await createMaskedCasePdf(masked, metadata)).toEqual(pdf);
    const {text, normalizedText} = await pdfContent(pdf);
    for (const expected of ["תיק מימון מוסווה לבחינה", "תקציר העסקה", "רכישה יד שנייה", "דירה", "הכנסות", "התחייבויות", "נכס ובקשת מימון", "פירוט העסקה", "כל מסמכי החובה קיימים בתיק"]) expect(normalizedText).toContain(expected);
    expect(text).not.toMatch(/[�□■]/u);
    for (const prohibited of ["דנה", "לוי", "123456789", "0501234567", "dana@example.com", "מעסיק סודי", "יועץ פרטי"]) expect(text).not.toContain(prohibited);
  });
});

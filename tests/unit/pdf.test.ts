import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { createAnonymousPdf } from "../../src/services/pdf";

describe("anonymous PDF", () => {
  it("is generated only from the anonymous snapshot", async () => {
    const pdf = await createAnonymousPdf({
      publicCaseNumber: "SC-SAFE-123", dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyRegion: "CENTER",
      propertyValue: 2_000_000, requestedAmount: 1_000_000, financingPercentage: 50, numberOfBorrowers: 2,
      borrowerRelationship: "COUPLE", borrowerAges: [41, 39], employmentTypes: ["SALARIED", "SELF_EMPLOYED"],
      totalMonthlyIncome: 35_000, totalMonthlyPayments: 5_000, existingMortgageBalance: 400_000, requestedTermMonths: 240
    });
    const document = await getDocument({data: new Uint8Array(pdf)}).promise;
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
    expect(text).toContain("SC-SAFE-123");
    expect(text).not.toMatch(/Dana|123456789|0500000000|dana@example|Street|Employer|clientId|advisorId|lenderId/);
  });
});

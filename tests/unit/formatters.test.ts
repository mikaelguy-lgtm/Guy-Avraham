import { describe, expect, it } from "vitest";
import { DEAL_TYPES } from "../../src/domain/clientFields";
import { emailServerAcceptedMessage, formatAdditionalIncomeType, formatClientStatus, formatCurrency, formatDate, formatDealType, formatEmploymentType, formatIsraelDateTime, formatMaritalStatus, formatPropertyType, formatRegion, maskEmailAddress } from "../../src/utils/formatters";

describe("Hebrew display formatters", () => {
  it("never exposes business enums", () => {
    const expectedDeals = ["רכישה מקבלן", "מחיר למשתכן", "רכישה יד שנייה", "שיפוצים", "איחוד הלוואות", "מטרה עסקית", "לכל מטרה", "בנייה עצמית", "עסקה בתוך המשפחה", "רכישה או בנייה בקיבוץ", "רכישה מכונס נכסים", "משכנתה הפוכה", "תמ״א", "מחזור משכנתה", "גישור"];
    expect(DEAL_TYPES.map(formatDealType)).toEqual(expectedDeals);
    expect(formatEmploymentType("SALARIED")).toBe("שכיר");
    expect(formatEmploymentType("SELF_EMPLOYED")).toBe("עצמאי");
    expect(formatPropertyType("APARTMENT")).toBe("דירה");
    expect(formatPropertyType("HOUSE")).toBe("בית פרטי");
    expect(formatRegion("CENTER")).toBe("מרכז");
    expect(formatRegion("NORTH")).toBe("צפון");
    expect(formatRegion("SOUTH")).toBe("דרום");
    expect(formatRegion("JERUSALEM")).toBe("ירושלים");
    expect(formatClientStatus("DRAFT")).toBe("טיוטה");
    expect(formatMaritalStatus("COMMON_LAW")).toBe("ידועים בציבור");
    expect(formatMaritalStatus("SEPARATED")).toBe("פרוד/ה");
    expect(formatAdditionalIncomeType("RENTAL_INCOME")).toBe("שכר דירה");
  });

  it("formats Israeli currency", () => {
    expect(formatCurrency(1_000_000)).toContain("1,000,000");
  });

  it.each([
    ["2026-01-15T12:30:00.000Z", "15/01/2026 14:30"],
    ["2026-07-15T12:30:00.000Z", "15/07/2026 15:30"],
    ["2026-03-26T22:30:00.000Z", "27/03/2026 00:30"],
    ["2026-10-24T22:30:00.000Z", "25/10/2026 01:30"]
  ])("formats %s in Asia/Jerusalem", (value, expected) => {
    expect(formatIsraelDateTime(value)).toBe(expected);
  });

  it("keeps date-only values stable and masks email delivery guidance", () => {
    expect(formatDate("2026-08-01")).toBe("01/08/2026");
    expect(maskEmailAddress("advisor@example.com")).toBe("ad*****@e******.com");
    const message = emailServerAcceptedMessage("advisor@example.com");
    expect(message).toContain("נשלח לשרת הדואר");
    expect(message).toContain("ספאם, דואר זבל וקידומי מכירות");
    expect(message).not.toContain("advisor@example.com");
  });
});

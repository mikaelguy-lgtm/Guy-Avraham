import { describe, expect, it } from "vitest";
import { DEAL_TYPES } from "../../src/domain/clientFields";
import { formatAdditionalIncomeType, formatClientStatus, formatCurrency, formatDealType, formatEmploymentType, formatMaritalStatus, formatPropertyType, formatRegion } from "../../src/utils/formatters";

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
});

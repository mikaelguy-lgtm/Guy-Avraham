import {describe, expect, it} from "vitest";
import {getDocumentDisplayName, getDocumentDownloadName} from "../../src/utils/documentDisplay";

describe("document display names", () => {
  it.each([
    ["ID_FRONT", "תעודת זהות — צד קדמי"],
    ["ID_BACK", "תעודת זהות — צד אחורי"],
    ["ID_APPENDIX", "ספח תעודת זהות"],
    ["PROPERTY_RIGHTS", "נסח טאבו או אישור זכויות"],
    ["POWER_OF_ATTORNEY", "כתב הסמכה"]
  ])("maps %s to its business name", (documentType, expectedName) => {
    expect(getDocumentDisplayName({documentType, customTitle: null})).toBe(expectedName);
  });

  it("prefixes an additional document custom title", () => {
    expect(getDocumentDisplayName({documentType: "OTHER", customTitle: "  שומת שמאי  "})).toBe("מסמך נוסף — שומת שמאי");
  });

  it("uses a safe fallback for an additional document without a title", () => {
    expect(getDocumentDisplayName({documentType: "OTHER", customTitle: null})).toBe("מסמך נוסף");
  });

  it("creates a business download name without the uploaded filename", () => {
    expect(getDocumentDownloadName({documentType: "ID_FRONT", customTitle: null, mimeType: "application/pdf"})).toBe("תעודת זהות — צד קדמי.pdf");
  });
});

describe("safeArchiveSegment (zip-slip guard)", () => {
  it.each([
    ["../../../../Startup/x", "Startup"],
    ["..\\..\\evil.exe", "evil.exe"],
    ["C:\\Windows\\system32", "system32"],
    ["  .hidden. ", "hidden"],
    ["name\u0000with\u001fcontrols", "controls"],
    ["דוח שכר ינואר", "דוח שכר ינואר"]
  ])("neutralizes path parts in %j", async (input, keeps) => {
    const {safeArchiveSegment} = await import("../../src/utils/documentDisplay");
    const result = safeArchiveSegment(input);
    expect(result).toContain(keeps);
    expect(result).not.toMatch(/[\\/:]|\.\./);
    expect(result.includes("\u0000")).toBe(false);
    expect(result.startsWith(".")).toBe(false);
  });

  it("never returns an empty segment", async () => {
    const {safeArchiveSegment} = await import("../../src/utils/documentDisplay");
    expect(safeArchiveSegment("")).toBe("מסמך");
    expect(safeArchiveSegment("..")).not.toBe("");
  });
});

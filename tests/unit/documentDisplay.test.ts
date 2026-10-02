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

import { describe, expect, it } from "vitest";
import { listMissingRequiredDocuments } from "../../src/domain/requiredDocuments";

describe("required client documents", () => {
  it("requires six documents for one borrower", () => {
    expect(listMissingRequiredDocuments([{id: 1, borrowerOrder: 1}], [])).toHaveLength(6);
  });
  it("requires ten documents for two borrowers", () => {
    expect(listMissingRequiredDocuments([{id: 1, borrowerOrder: 1}, {id: 2, borrowerOrder: 2}], [])).toHaveLength(10);
  });
  it("treats rejected and deleted documents as missing", () => {
    const missing = listMissingRequiredDocuments([{id: 1, borrowerOrder: 1}], [{borrowerId: 1, documentType: "ID_FRONT", status: "REJECTED"}, {borrowerId: null, documentType: "PROPERTY_RIGHTS", status: "UPLOADED", deletedAt: new Date()}]);
    expect(missing.map((item) => item.documentType)).toEqual(expect.arrayContaining(["ID_FRONT", "PROPERTY_RIGHTS"]));
  });
});

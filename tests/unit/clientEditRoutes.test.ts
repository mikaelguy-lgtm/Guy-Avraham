import { describe, expect, it } from "vitest";
import { clientEditPath, clientTabFromSearch, clientTabPath, editSectionForTab } from "../../src/utils/clientEditRoutes";

describe("client edit routes", () => {
  it("maps focused edit routes back to their tabs", () => {
    expect(clientEditPath(12, "liabilities")).toBe("/advisor/clients/12/edit/liabilities");
    expect(clientTabPath(12, "liabilities")).toBe("/advisor/clients/12?tab=liabilities");
    expect(editSectionForTab("property")).toBe("property");
    expect(editSectionForTab("documents")).toBeNull();
  });

  it("preserves supported query tabs and redirects legacy tabs", () => {
    expect(clientTabFromSearch("?tab=income")).toBe("income");
    expect(clientTabFromSearch("?tab=identity-reveal")).toBe("summary");
    expect(clientTabFromSearch("?tab=activity")).toBe("summary");
  });
});

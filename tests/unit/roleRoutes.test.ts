import { describe, expect, it } from "vitest";
import { canAccessAdmin, canAccessSmtpSettings, homePathForRole } from "../../src/utils/roleRoutes";

describe("role routes", () => {
  it.each([
    ["SUPER_ADMIN", "/admin"],
    ["ADMIN", "/admin"],
    ["ADVISOR", "/advisor"],
    ["LENDER_ADMIN", "/lender"],
    ["LENDER_UNDERWRITER", "/lender"]
  ] as const)("routes %s to its permitted dashboard", (role, expectedPath) => {
    expect(homePathForRole(role)).toBe(expectedPath);
  });

  it("allows only administrative roles into the admin dashboard", () => {
    expect(canAccessAdmin("SUPER_ADMIN")).toBe(true);
    expect(canAccessAdmin("ADMIN")).toBe(true);
    expect(canAccessAdmin("ADVISOR")).toBe(false);
    expect(canAccessAdmin("LENDER_ADMIN")).toBe(false);
    expect(canAccessAdmin("LENDER_UNDERWRITER")).toBe(false);
  });

  it("allows only SUPER_ADMIN into SMTP settings", () => {
    expect(canAccessSmtpSettings("SUPER_ADMIN")).toBe(true);
    expect(canAccessSmtpSettings("ADMIN")).toBe(false);
    expect(canAccessSmtpSettings("ADVISOR")).toBe(false);
    expect(canAccessSmtpSettings("LENDER_ADMIN")).toBe(false);
    expect(canAccessSmtpSettings("LENDER_UNDERWRITER")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { advisorRegistrationApiSchema, advisorRegistrationFormSchema, normalizeEmail, normalizeIsraeliPhone, passwordRequirements, passwordStrength } from "../../src/domain/advisorRegistration";
import { formatUserStatus } from "../../src/utils/formatters";

const valid = {
  firstName: "  דנה  ", lastName: " Levi ", email: " ADVISOR@Example.COM ", phone: "050-123-4567",
  businessName: "  משרד   דנה  ", password: "Strong!Pass1", confirmPassword: "Strong!Pass1", acceptTerms: true as const
};

describe("advisor self-registration validation", () => {
  it("normalizes email, names and Israeli phone", () => {
    const parsed = advisorRegistrationFormSchema.parse(valid);
    expect(normalizeEmail(valid.email)).toBe("advisor@example.com");
    expect(normalizeIsraeliPhone(valid.phone)).toBe("+972501234567");
    expect(parsed.firstName).toBe("דנה");
    expect(parsed.businessName).toBe("משרד דנה");
  });

  it("rejects invalid phone and company name", () => {
    expect(advisorRegistrationFormSchema.safeParse({...valid, phone: "123", businessName: "א"}).success).toBe(false);
  });

  it("requires a strong matching password", () => {
    expect(advisorRegistrationFormSchema.safeParse({...valid, password: "weak", confirmPassword: "different"}).success).toBe(false);
    expect(advisorRegistrationFormSchema.safeParse({...valid, password: "Strong Pass1!", confirmPassword: "Strong Pass1!"}).success).toBe(false);
    expect(passwordRequirements(valid.password, valid.confirmPassword).every((requirement) => requirement.met)).toBe(true);
    expect(passwordStrength(valid.password, valid.confirmPassword)).toEqual({score: 7, label: "חזקה מאוד"});
  });

  it("does not accept role or status from the browser", () => {
    expect(advisorRegistrationApiSchema.safeParse({...valid, role: "SUPER_ADMIN"}).success).toBe(false);
    expect(advisorRegistrationApiSchema.safeParse({...valid, status: "ACTIVE"}).success).toBe(false);
  });

  it("maps registration statuses to Hebrew", () => {
    expect(formatUserStatus("PENDING")).toBe("ממתין");
    expect(formatUserStatus("ACTIVE")).toBe("פעיל");
    expect(formatUserStatus("SUSPENDED")).toBe("מושעה");
  });
});

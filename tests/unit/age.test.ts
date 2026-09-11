import { describe, expect, it } from "vitest";
import { calculateAge, validateAdultBirthDate } from "../../src/utils/age";

describe("automatic borrower age", () => {
  it("uses the exact birthday boundary", () => {
    expect(calculateAge("2000-07-24", new Date("2026-07-23T12:00:00Z"))).toBe(25);
    expect(calculateAge("2000-07-23", new Date("2026-07-23T12:00:00Z"))).toBe(26);
  });

  it("handles leap-day births consistently", () => {
    expect(calculateAge("2000-02-29", new Date("2025-02-28T12:00:00Z"))).toBe(24);
    expect(calculateAge("2000-02-29", new Date("2025-03-01T12:00:00Z"))).toBe(25);
  });

  it("rejects future, underage and implausible dates", () => {
    expect(validateAdultBirthDate("2030-01-01", new Date("2026-07-23T12:00:00Z"))).toMatch(/בעתיד/);
    expect(validateAdultBirthDate("2010-01-01", new Date("2026-07-23T12:00:00Z"))).toMatch(/18/);
    expect(validateAdultBirthDate("1800-01-01", new Date("2026-07-23T12:00:00Z"))).toMatch(/120/);
  });
});

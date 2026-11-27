import {describe, expect, it} from "vitest";
import {generateCaseNumber, isPublicCaseNumberConflict} from "../../src/domain/caseNumber";

describe("short display case number", () => {
  it("is SC- followed by exactly 7 digits with a non-zero first digit", () => {
    for (let index = 0; index < 2000; index += 1) expect(generateCaseNumber()).toMatch(/^SC-[1-9]\d{6}$/);
  });

  it("covers the whole 7-digit range at its edges", () => {
    expect(generateCaseNumber((min) => min)).toBe("SC-1000000");
    expect(generateCaseNumber((_min, max) => max - 1)).toBe("SC-9999999");
  });

  it("recognises only a unique-violation on the case-number constraint, including when wrapped", () => {
    const raw = Object.assign(new Error("dup"), {code: "23505", constraint: "clients_public_case_number_unique"});
    expect(isPublicCaseNumberConflict(raw)).toBe(true);
    expect(isPublicCaseNumberConflict(Object.assign(new Error("Failed query"), {cause: raw}))).toBe(true);
    expect(isPublicCaseNumberConflict(Object.assign(new Error("dup"), {code: "23505", constraint: "users_email_unique"}))).toBe(false);
    expect(isPublicCaseNumberConflict(new Error("other"))).toBe(false);
  });
});

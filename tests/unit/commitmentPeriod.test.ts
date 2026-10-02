import { describe, expect, it } from "vitest";
import { calculateRemainingCommitmentPeriod } from "../../src/utils/commitmentPeriod";

describe("remaining commitment period", () => {
  it("calculates complete years and months", () => {
    expect(calculateRemainingCommitmentPeriod("2029-05-20", "2026-03-10")).toEqual(expect.objectContaining({years: 3, months: 2, label: "3 שנים ו־2 חודשים"}));
  });
  it("handles one year and one month", () => {
    expect(calculateRemainingCommitmentPeriod("2027-04-10", "2026-03-10")?.label).toBe("שנה ו־חודש");
  });
  it("returns less than a month and rejects past dates", () => {
    expect(calculateRemainingCommitmentPeriod("2026-03-20", "2026-03-10")?.label).toBe("פחות מחודש");
    expect(calculateRemainingCommitmentPeriod("2026-03-01", "2026-03-10")).toBeNull();
  });
});

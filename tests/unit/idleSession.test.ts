import { describe, expect, it } from "vitest";
import { IDLE_TIMEOUT_MS, IDLE_WARNING_AT_MS, isSessionFresh, sessionAnchor } from "../../src/domain/idleSession";

const minutes = (value: number) => value * 60 * 1000;

describe("idle session rule", () => {
  const now = new Date("2026-09-26T10:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("uses fixed 5-minute timeout with a warning 30 seconds before", () => {
    expect(IDLE_TIMEOUT_MS).toBe(minutes(5));
    expect(IDLE_WARNING_AT_MS).toBe(minutes(4.5));
  });

  it("is fresh at 4:59 and expired at 5:01 of inactivity", () => {
    expect(isSessionFresh(ago(minutes(4) + 59_000), ago(minutes(30)), now)).toBe(true);
    expect(isSessionFresh(ago(minutes(5)), ago(minutes(30)), now)).toBe(true);
    expect(isSessionFresh(ago(minutes(5) + 1_000), ago(minutes(30)), now)).toBe(false);
  });

  it("a fresh Firebase sign-in (auth_time) starts a new window even after an expired activity anchor", () => {
    expect(isSessionFresh(ago(minutes(20)), ago(minutes(1)), now)).toBe(true);
    expect(isSessionFresh(null, ago(minutes(1)), now)).toBe(true);
  });

  it("an old auth_time cannot resurrect an expired session (silent token refresh keeps auth_time)", () => {
    expect(isSessionFresh(ago(minutes(6)), ago(minutes(60)), now)).toBe(false);
    expect(isSessionFresh(null, ago(minutes(6)), now)).toBe(false);
  });

  it("no anchor at all means not fresh", () => {
    expect(isSessionFresh(null, null, now)).toBe(false);
    expect(isSessionFresh(undefined, undefined, now)).toBe(false);
    expect(sessionAnchor(null, undefined)).toBeNull();
  });

  it("picks the later of the two anchors", () => {
    expect(sessionAnchor(ago(minutes(3)), ago(minutes(1)))?.getTime()).toBe(ago(minutes(1)).getTime());
    expect(sessionAnchor(ago(minutes(1)), ago(minutes(3)))?.getTime()).toBe(ago(minutes(1)).getTime());
  });
});

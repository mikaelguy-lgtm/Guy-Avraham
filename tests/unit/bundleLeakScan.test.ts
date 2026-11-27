// The deploy health gate greps the built frontend bundle for leaked secret
// env-var names. 2026-11: a plain substring match flagged the audit label
// SMTP_PASSWORD_CLEARED and blocked a release; a naive whole-word fix then
// stopped catching real names like S3_SECRET_KEY / FIREBASE_PRIVATE_KEY.
// This pins both directions against the exact pattern in the shell script.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

const script = readFileSync("scripts/healthcheck-production.sh", "utf8");
const pattern = /BUNDLE_LEAK_PATTERN='([^']+)'/.exec(script)?.[1] ?? "";

function flagged(sample: string): boolean {
  try { execFileSync("grep", ["-qE", pattern], {input: sample}); return true; } catch { return false; }
}

describe("frontend bundle leak scan (deploy health gate)", () => {
  it("has a pattern", () => { expect(pattern.length).toBeGreaterThan(20); });

  it.each(["process.env.SMTP_PASSWORD", "S3_SECRET_KEY=abc", "FIREBASE_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----", "\"DATABASE_URL\"", "TOKEN_HASH_SECRET", "LOCAL_SECRET_MASTER_KEY", "http://localhost:3000", "host:9099"])("flags %s", (sample) => {
    expect(flagged(sample)).toBe(true);
  });

  it.each(["a={SMTP_PASSWORD_CLEARED:\"x\"}", "PASSWORD_RESET_EXPIRY_MINUTES", "שכחתי סיסמה", "SynCash"])("does not flag %s", (sample) => {
    expect(flagged(sample)).toBe(false);
  });
});

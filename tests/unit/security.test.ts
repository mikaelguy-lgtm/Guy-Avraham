import { describe, expect, it } from "vitest";
import { hashToken } from "../../src/utils/crypto";
import { sanitizeEmailError } from "../../src/services/email";
import { loadEnv } from "../../src/config/env";

describe("security utilities", () => {
  it("hashes invite tokens without retaining the source", () => {
    const token = "secret-invite-token";
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });

  it("sanitizes provider email failures", () => {
    expect(sanitizeEmailError()).toBe("Email delivery failed");
  });

  it("rejects wildcard CORS in production", () => {
    expect(() => loadEnv({
      NODE_ENV: "production", APP_URL: "https://app.example", API_URL: "https://api.example", ALLOWED_ORIGINS: "*",
      DATABASE_URL: "postgres://example", REDIS_URL: "redis://example", FIREBASE_PROJECT_ID: "project",
      FIREBASE_CLIENT_EMAIL: "service@example.com", FIREBASE_PRIVATE_KEY: "key", SECRET_PROVIDER: "environment",
      FIELD_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"), S3_ENDPOINT: "https://s3.example", S3_REGION: "us-east-1",
      S3_BUCKET: "bucket", S3_ACCESS_KEY_ID: "id", S3_SECRET_KEY: "secret", SMTP_HOST: "smtp.example",
      SMTP_PORT: "587", EMAIL_FROM: "no-reply@example.com", EMAIL_FROM_NAME: "SynCash", EMAIL_REPLY_TO: "support@example.com",
      GEMINI_MODEL: "model"
    })).toThrow(/Wildcard CORS/);
  });
});


import { describe, expect, it } from "vitest";
import { hashToken } from "../../src/utils/crypto";
import { sanitizeEmailError, sanitizeSmtpFailure, SmtpServiceError } from "../../src/services/email";
import { loadEnv } from "../../src/config/env";

describe("security utilities", () => {
  const productionEnvironment = () => ({
    NODE_ENV: "production",
    APP_URL: "https://app.example",
    API_URL: "https://api.example",
    ALLOWED_ORIGINS: "https://app.example",
    DATABASE_URL: "postgres://example",
    REDIS_URL: "redis://example",
    FIREBASE_PROJECT_ID: "project",
    FIREBASE_CLIENT_EMAIL: "service@example.com",
    S3_ENDPOINT: "https://s3.example",
    S3_REGION: "us-east-1",
    S3_BUCKET: "bucket",
    S3_ACCESS_KEY_ID: "id",
    S3_SECRET_KEY: "secret",
    SMTP_HOST: "smtp.example",
    SMTP_PORT: "587",
    EMAIL_FROM: "no-reply@example.com",
    EMAIL_FROM_NAME: "SynCash",
    EMAIL_REPLY_TO: "support@example.com",
    COOKIE_SECRET: "cookie-secret",
    SESSION_SECRET: "session-secret",
    TOKEN_HASH_SECRET: "token-secret",
    GEMINI_MODEL: "model"
  });

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
      ...productionEnvironment(), ALLOWED_ORIGINS: "*",
      FIREBASE_CLIENT_EMAIL: "service@example.com", FIREBASE_PRIVATE_KEY: "key", SECRET_PROVIDER: "environment",
      FIELD_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64")
    })).toThrow(/Wildcard CORS/);
  });

  it("allows Google Secret Manager to supply production private keys", () => {
    const env = loadEnv({...productionEnvironment(), SECRET_PROVIDER: "google", GOOGLE_CLOUD_PROJECT: "project"});
    expect(env.FIREBASE_PRIVATE_KEY).toBe("");
    expect(env.FIELD_ENCRYPTION_KEY).toBe("");
  });

  it("requires a Google Cloud project for the production Google provider", () => {
    expect(() => loadEnv({...productionEnvironment(), SECRET_PROVIDER: "google"})).toThrow(/GOOGLE_CLOUD_PROJECT/);
  });

  it("allows production startup with email delivery explicitly disabled", () => {
    const env = loadEnv({
      ...productionEnvironment(),
      EMAIL_DELIVERY_ENABLED: "false",
      SMTP_HOST: "",
      EMAIL_FROM: "",
      EMAIL_REPLY_TO: "",
      SECRET_PROVIDER: "google",
      GOOGLE_CLOUD_PROJECT: "project"
    });
    expect(env.EMAIL_DELIVERY_ENABLED).toBe(false);
    expect(sanitizeSmtpFailure(new SmtpServiceError("EMAIL_DELIVERY_DISABLED"))).toMatchObject({
      code: "EMAIL_DELIVERY_DISABLED",
      status: 503
    });
  });
});


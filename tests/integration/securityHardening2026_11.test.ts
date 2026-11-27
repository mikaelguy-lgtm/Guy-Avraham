// Security hardening, 2026-11 full-product audit. Each test pins one finding
// so a later change cannot silently reopen it.
import request from "supertest";
import {describe, expect, it, vi} from "vitest";
import {createApp} from "../../src/server/app";
import {EmailService} from "../../src/services/email";
import {AdvisorEmailVerificationService} from "../../src/services/emailVerification";
import {rateLimit, type RateLimitStore} from "../../src/services/rateLimiter";
import {EncryptionService} from "../../src/utils/crypto";
import {env, makeStore, MemoryLimiter, MemoryStorage, secrets, verifier} from "../helpers/fakes";
import express from "express";

function app(overrides: Parameters<typeof makeStore>[0] = {}, limiter: RateLimitStore = new MemoryLimiter()) {
  const store = makeStore(overrides);
  const email = {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn(), reload: vi.fn(), isDeliveryActive: vi.fn().mockResolvedValue(true)} as unknown as EmailService;
  return {store, email, app: createApp({
    env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter, secrets, email,
    emailVerification: new AdvisorEmailVerificationService({createVerificationLink: vi.fn().mockResolvedValue({url: "http://localhost:9099/verify?oobCode=private"})}, email, store),
    passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
    gemini: {analyze: vi.fn().mockResolvedValue("analysis")} as never,
    firebaseAccounts: {deleteUser: vi.fn().mockResolvedValue(undefined), updateUserEmail: vi.fn().mockResolvedValue(undefined), revokeRefreshTokens: vi.fn().mockResolvedValue(undefined)}
  })};
}

describe("legacy advisor-selected submission flow is closed", () => {
  it("rejects POST /api/clients/:id/submissions with 410 and never emails a lender", async () => {
    const createSubmission = vi.fn();
    const {app: application, email} = app({createSubmission} as never);
    const response = await request(application).post("/api/clients/1/submissions").set("authorization", "Bearer advisor").send({lenderIds: [100]}).expect(410);
    expect(response.body.error).toBe("LEGACY_SUBMISSION_FLOW_REMOVED");
    expect(email.send).not.toHaveBeenCalled();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("still enforces ownership before answering (another advisor gets 403, not 410)", async () => {
    await request(app().app).post("/api/clients/1/submissions").set("authorization", "Bearer advisor2").send({lenderIds: [100]}).expect(403);
  });

  it("rejects the legacy retry-delivery route with 410", async () => {
    const {app: application, email} = app();
    await request(application).post("/api/submissions/1/retry-delivery").set("authorization", "Bearer advisor").expect(410);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe("document delete authorization", () => {
  const deletedClientDocument = {id: 5, clientId: 99, borrowerId: null, uploadedByUserId: 1, customTitle: null, descriptionEncrypted: null, storageKey: "doc", originalFileName: "doc.pdf", documentType: "OTHER", mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "a".repeat(64), status: "UPLOADED", deletedAt: null};

  it.each(["lender", "admin"])("a %s user (advisorId null) cannot delete a document of a soft-deleted client", async (role) => {
    const softDeleteDocument = vi.fn();
    const {app: application} = app({getDocument: async () => deletedClientDocument as never, getClientAdvisorId: async () => null, softDeleteDocument});
    await request(application).delete("/api/documents/5").set("authorization", `Bearer ${role}`).expect(403);
    expect(softDeleteDocument).not.toHaveBeenCalled();
  });

  it("returns 404 (not 500) for a non-numeric document id", async () => {
    await request(app().app).delete("/api/documents/abc").set("authorization", "Bearer advisor").expect(404);
    await request(app().app).get("/api/documents/abc/download").set("authorization", "Bearer advisor").expect(404);
  });
});

describe("client-side errors are not reported as 500", () => {
  it("returns 400 for malformed JSON", async () => {
    await request(app().app).post("/api/privacy-requests").set("content-type", "application/json").send("{not json").expect(400);
  });
});

describe("request id hygiene", () => {
  it("accepts a well-formed x-request-id and replaces a malformed one", async () => {
    const good = await request(app().app).get("/api/health").set("x-request-id", "abc-12345-def").expect(200);
    expect(good.headers["x-request-id"]).toBe("abc-12345-def");
    const bad = await request(app().app).get("/api/health").set("x-request-id", "evil\" injected <script>").expect(200);
    expect(bad.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("rate-limit identity behind the host nginx proxy", () => {
  it("keys anonymous limits by the real client address (rightmost X-Forwarded-For hop), not the proxy", async () => {
    const limiter = new MemoryLimiter();
    const increment = vi.spyOn(limiter, "increment");
    const {app: application} = app({}, limiter);
    await request(application).post("/api/auth/login-attempt").set("x-forwarded-for", "203.0.113.7").expect(200);
    await request(application).post("/api/auth/login-attempt").set("x-forwarded-for", "1.1.1.1, 198.51.100.9").expect(200);
    const keys = increment.mock.calls.map(([key]) => key);
    expect(keys).toContain("rate:login-attempt:ip:203.0.113.7");
    // A client-forged leftmost entry is ignored; the hop nginx appended wins.
    expect(keys).toContain("rate:login-attempt:ip:198.51.100.9");
    expect(keys.some((key) => key.includes("1.1.1.1"))).toBe(false);
  });

  it("two different clients no longer share one bucket", async () => {
    const {app: application} = app();
    // NODE_ENV=test → מגבלת 100 ניסיונות (10 בייצור).
    for (let index = 0; index < 100; index += 1) await request(application).post("/api/auth/login-attempt").set("x-forwarded-for", "203.0.113.1").expect(200);
    await request(application).post("/api/auth/login-attempt").set("x-forwarded-for", "203.0.113.1").expect(429);
    await request(application).post("/api/auth/login-attempt").set("x-forwarded-for", "203.0.113.2").expect(200);
  });
});

describe("rate limiter survives a Redis outage", () => {
  it("falls back to in-memory counting instead of failing the request", async () => {
    const broken: RateLimitStore = {increment: async () => { throw new Error("redis down"); }, ping: async () => false};
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const application = express();
    application.get("/limited", rateLimit(broken, "fallback-test", 2, 60), (_request, response) => { response.json({ok: true}); });
    await request(application).get("/limited").expect(200);
    await request(application).get("/limited").expect(200);
    await request(application).get("/limited").expect(429);
    errorSpy.mockRestore();
  });
});

describe("foreign-key conflicts are explained, not reported as 500", () => {
  it.each([
    ["a raw pg error", Object.assign(new Error("fk"), {code: "23503"})],
    ["a Drizzle-wrapped pg error", Object.assign(new Error("Failed query"), {cause: Object.assign(new Error("fk"), {code: "23503"})})]
  ])("maps %s to 409 RELATED_RECORDS_EXIST", async (_label, failure) => {
    const {app: application} = app({softDeleteClient: async () => { throw failure; }});
    const response = await request(application).delete("/api/clients/1").set("authorization", "Bearer advisor").expect(409);
    expect(response.body.error).toBe("RELATED_RECORDS_EXIST");
    expect(JSON.stringify(response.body)).not.toContain("fk");
  });
});

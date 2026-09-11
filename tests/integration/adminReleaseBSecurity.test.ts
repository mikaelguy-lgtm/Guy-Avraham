import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { EmailService } from "../../src/services/email";
import { AdvisorEmailVerificationService } from "../../src/services/emailVerification";
import { EncryptionService } from "../../src/utils/crypto";
import { env, makeStore, MemoryLimiter, MemoryStorage, secrets, users, verifier } from "../helpers/fakes";

function app(overrides: Parameters<typeof makeStore>[0] = {}) {
  const store = makeStore(overrides);
  const email = {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn(), reload: vi.fn(), isDeliveryActive: vi.fn().mockResolvedValue(true)} as unknown as EmailService;
  return createApp({
    env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets,
    email,
    emailVerification: new AdvisorEmailVerificationService({createVerificationLink: vi.fn().mockResolvedValue({url: "http://localhost:9099/verify?oobCode=private"})}, email, store),
    passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
    gemini: {analyze: vi.fn().mockResolvedValue("analysis")} as never,
    firebaseAccounts: {deleteUser: vi.fn().mockResolvedValue(undefined), updateUserEmail: vi.fn().mockResolvedValue(undefined)}
  });
}

// SUPER_ADMIN case editing reuses the existing advisor PATCH endpoints
// verbatim (same validation, same store methods) — only the route guard
// changed from ADVISOR-only to ADVISOR-or-SUPER_ADMIN. This proves that
// change without weakening the existing ADVISOR-to-ADVISOR boundary or
// opening the route to LENDER.
describe("SUPER_ADMIN case editing reuses the existing advisor endpoints without weakening advisor isolation", () => {
  it("still blocks one advisor from editing another advisor's client", async () => {
    const instance = app();
    await request(instance).patch("/api/clients/2").set("authorization", "Bearer advisor").send({}).expect(403);
  });

  it("blocks LENDER from the client-edit endpoint entirely", async () => {
    const instance = app();
    await request(instance).patch("/api/clients/1").set("authorization", "Bearer lender").send({}).expect(403);
  });

  it("allows SUPER_ADMIN through the route guard for a client owned by any advisor (reaches validation, not blocked by role/ownership)", async () => {
    const instance = app();
    // An empty body fails Zod validation (400) rather than the route guard
    // (403) — proving SUPER_ADMIN passed both requireRole and
    // requireAdvisorClientAccess and reached the real, unmodified handler.
    const response = await request(instance).patch("/api/clients/2").set("authorization", "Bearer super").send({});
    expect(response.status).not.toBe(403);
  });
});

describe("Release B — new admin-settings/audit-log routes require SUPER_ADMIN", () => {
  const routes: Array<[string, string]> = [
    ["get", "/api/admin/settings/notifications"],
    ["patch", "/api/admin/settings/notifications"],
    ["get", "/api/admin/audit-logs"]
  ];
  for (const [method, path] of routes) {
    it(`blocks ADVISOR, LENDER and ADMIN for ${method.toUpperCase()} ${path}`, async () => {
      const instance = app();
      await request(instance)[method as "get"](path).set("authorization", "Bearer advisor").send({}).expect(403);
      await request(instance)[method as "get"](path).set("authorization", "Bearer lender").send({}).expect(403);
      await request(instance)[method as "get"](path).set("authorization", "Bearer admin").send({}).expect(403);
    });
  }
});

// Tests C & D from the approved spec: notification reads/writes are scoped
// strictly by the authenticated caller's own userId — an ADVISOR can never
// read a SUPER_ADMIN's notification, and two different SUPER_ADMINs each
// see only their own, even though both call the exact same generic routes.
describe("Notification authorization is scoped by the caller's own userId, not by role", () => {
  function notificationStore() {
    const rows = [
      {id: 101, userId: users.super.id, type: "SUPER_ADMIN_CASE_CREATED", title: "לסופר אדמין א׳", body: "b", readAt: null as string | null, createdAt: new Date().toISOString(), entityType: "client", entityId: 1},
      {id: 102, userId: users.super2.id, type: "SUPER_ADMIN_CASE_CREATED", title: "לסופר אדמין ב׳", body: "b", readAt: null as string | null, createdAt: new Date().toISOString(), entityType: "client", entityId: 2}
    ];
    return {
      listNotifications: vi.fn(async (userId: number) => rows.filter((row) => row.userId === userId)),
      markNotificationRead: vi.fn(async (id: number, userId: number) => {
        const row = rows.find((candidate) => candidate.id === id && candidate.userId === userId);
        if (!row) return false;
        row.readAt = new Date().toISOString();
        return true;
      })
    };
  }

  it("(C) an ADVISOR calling GET /api/notifications never receives a SUPER_ADMIN's notification content", async () => {
    const store = notificationStore();
    const instance = app(store);
    const response = await request(instance).get("/api/notifications").set("authorization", "Bearer advisor").expect(200);
    expect(response.body).toEqual([]);
    expect(response.body.some((row: {title: string}) => row.title.includes("סופר אדמין"))).toBe(false);
  });

  it("(C) an ADVISOR cannot mark a SUPER_ADMIN's notification as read", async () => {
    const store = notificationStore();
    const instance = app(store);
    await request(instance).patch("/api/notifications/101/read").set("authorization", "Bearer advisor").expect(404);
  });

  it("(D) two different SUPER_ADMINs each see only their own notification", async () => {
    const store = notificationStore();
    const instance = app(store);
    const first = await request(instance).get("/api/notifications").set("authorization", "Bearer super").expect(200);
    const second = await request(instance).get("/api/notifications").set("authorization", "Bearer super2").expect(200);
    expect(first.body).toEqual([expect.objectContaining({id: 101, title: "לסופר אדמין א׳"})]);
    expect(second.body).toEqual([expect.objectContaining({id: 102, title: "לסופר אדמין ב׳"})]);
  });

  it("(D) SUPER_ADMIN A marking their own notification read never marks SUPER_ADMIN B's", async () => {
    const store = notificationStore();
    const instance = app(store);
    await request(instance).patch("/api/notifications/101/read").set("authorization", "Bearer super").expect(200);
    const second = await request(instance).get("/api/notifications").set("authorization", "Bearer super2").expect(200);
    expect(second.body[0].readAt).toBeNull();
  });
});

// Tests G & H: the audit-privacy allow-list for the one Release B endpoint
// that can carry either kind of field (a free-text email vs plain booleans).
describe("Admin notification settings audit entry follows the privacy allow-list", () => {
  it("(G) changing the notification email logs only {field:'email', changed:true} — never the address, in either direction", async () => {
    const addAudit = vi.fn();
    const getAdminNotificationSettings = vi.fn()
      .mockResolvedValueOnce({email: "old@example.com", notifyNewAdvisor: true, notifyNewCase: true, notifyLenderInterested: true, notifyEmailFailed: false, notifyDeadlinePassed: false, notifyPrivacyRequest: false})
      .mockResolvedValue({email: "new@example.com", notifyNewAdvisor: true, notifyNewCase: true, notifyLenderInterested: true, notifyEmailFailed: false, notifyDeadlinePassed: false, notifyPrivacyRequest: false});
    const instance = app({addAudit, getAdminNotificationSettings, setSettings: vi.fn()});
    await request(instance).patch("/api/admin/settings/notifications").set("authorization", "Bearer super").send({email: "new@example.com"}).expect(200);

    expect(addAudit).toHaveBeenCalledOnce();
    const metadata = addAudit.mock.calls[0][4] as {changedFields?: string[]; toggleChanges?: Record<string, unknown>};
    expect(metadata.changedFields).toEqual(["email"]);
    expect(metadata.toggleChanges).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toContain("old@example.com");
    expect(JSON.stringify(metadata)).not.toContain("new@example.com");
  });

  it("(H) toggling a boolean setting logs a real old/new value — booleans are on the allow-list", async () => {
    const addAudit = vi.fn();
    const getAdminNotificationSettings = vi.fn()
      .mockResolvedValueOnce({email: null, notifyNewAdvisor: true, notifyNewCase: true, notifyLenderInterested: true, notifyEmailFailed: false, notifyDeadlinePassed: false, notifyPrivacyRequest: false})
      .mockResolvedValue({email: null, notifyNewAdvisor: false, notifyNewCase: true, notifyLenderInterested: true, notifyEmailFailed: false, notifyDeadlinePassed: false, notifyPrivacyRequest: false});
    const instance = app({addAudit, getAdminNotificationSettings, setSettings: vi.fn()});
    await request(instance).patch("/api/admin/settings/notifications").set("authorization", "Bearer super").send({notifyNewAdvisor: false}).expect(200);

    expect(addAudit).toHaveBeenCalledOnce();
    const metadata = addAudit.mock.calls[0][4] as {changedFields?: string[]; toggleChanges?: Record<string, {old: boolean; new: boolean}>};
    expect(metadata.changedFields).toBeUndefined();
    expect(metadata.toggleChanges).toEqual({notifyNewAdvisor: {old: true, new: false}});
  });
});

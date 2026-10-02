import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import type { TokenVerifier } from "../../src/middleware/auth";
import { DeliveryEventBroker } from "../../src/services/deliveryEvents";
import { EmailService } from "../../src/services/email";
import { AdvisorEmailVerificationService } from "../../src/services/emailVerification";
import { EncryptionService } from "../../src/utils/crypto";
import { env, makeStore, MemoryLimiter, MemoryStorage, secrets, users } from "../helpers/fakes";

const minutes = (value: number) => value * 60 * 1000;

// בונה אפליקציה שבה אפשר לשלוט בשני עוגני הסשן: users.last_activity_at (בחנות) ו-auth_time (בטוקן).
function app(options: {lastActivityAgoMs: number | null; authTimeAgoMs: number}) {
  const now = Date.now();
  const touchUserActivity = vi.fn().mockResolvedValue(undefined);
  const clearUserActivity = vi.fn().mockResolvedValue(undefined);
  const addAudit = vi.fn().mockResolvedValue(undefined);
  const store = makeStore({
    findUserByFirebaseUid: async (uid) => {
      const user = users[uid];
      return user ? {...user, lastActivityAt: options.lastActivityAgoMs === null ? null : new Date(now - options.lastActivityAgoMs)} : null;
    },
    touchUserActivity, clearUserActivity, addAudit
  });
  const verifier: TokenVerifier = {
    verify: async (token) => ({uid: token, email: users[token]?.email, emailVerified: true, authTime: new Date(now - options.authTimeAgoMs)})
  };
  const revokeRefreshTokens = vi.fn().mockResolvedValue(undefined);
  const email = {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn(), reload: vi.fn(), isDeliveryActive: vi.fn().mockResolvedValue(true)} as unknown as EmailService;
  const instance = createApp({
    env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets, email,
    emailVerification: new AdvisorEmailVerificationService({createVerificationLink: vi.fn()}, email, store),
    passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
    gemini: {analyze: vi.fn()} as never,
    firebaseAccounts: {deleteUser: vi.fn(), updateUserEmail: vi.fn(), revokeRefreshTokens},
    // ה-SSE route נרשם רק כשקיים delivery; ה-handler עצמו משתמש רק ב-deliveryEvents.
    delivery: {} as never,
    deliveryEvents: new DeliveryEventBroker()
  });
  return {instance, touchUserActivity, clearUserActivity, addAudit, revokeRefreshTokens};
}

const expired = {lastActivityAgoMs: minutes(6), authTimeAgoMs: minutes(40)};
const active = {lastActivityAgoMs: minutes(4), authTimeAgoMs: minutes(40)};

describe("server-side idle timeout (5 minutes without real activity)", () => {
  it("rejects a protected business request after 5 minutes of inactivity and revokes Firebase tokens", async () => {
    const {instance, revokeRefreshTokens} = app(expired);
    const response = await request(instance).get("/api/clients").set("authorization", "Bearer advisor").expect(401);
    expect(response.body.error).toBe("IDLE_EXPIRED");
    expect(response.body.message).toBe("החיבור נותק לאחר מספר דקות ללא פעילות. ניתן להתחבר מחדש.");
    expect(revokeRefreshTokens).toHaveBeenCalledWith("advisor");
  });

  it("still allows the request at 4 minutes of inactivity", async () => {
    const {instance, revokeRefreshTokens} = app(active);
    const response = await request(instance).get("/api/clients").set("authorization", "Bearer advisor");
    expect(response.status).not.toBe(401);
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("applies to every authenticated role (ADVISOR, ADMIN, SUPER_ADMIN, LENDER)", async () => {
    const {instance} = app(expired);
    // /api/notifications is the one authenticated route every role can normally read.
    for (const token of ["advisor", "admin", "super", "lender"]) {
      const response = await request(instance).get("/api/notifications").set("authorization", `Bearer ${token}`);
      expect(response.status, token).toBe(401);
      expect(response.body.error, token).toBe("IDLE_EXPIRED");
    }
    const live = app(active);
    for (const token of ["advisor", "admin", "super", "lender"]) {
      expect((await request(live.instance).get("/api/auth/me").set("authorization", `Bearer ${token}`)).status, `${token} live`).toBe(200);
    }
  });

  it("does not let an expired session be revived through the activity endpoint", async () => {
    const {instance, touchUserActivity} = app(expired);
    const response = await request(instance).post("/api/auth/activity").set("authorization", "Bearer advisor").send({}).expect(401);
    expect(response.body.error).toBe("IDLE_EXPIRED");
    expect(touchUserActivity).not.toHaveBeenCalled();
  });

  it("records real activity for a live session", async () => {
    const {instance, touchUserActivity} = app(active);
    await request(instance).post("/api/auth/activity").set("authorization", "Bearer advisor").send({}).expect(204);
    expect(touchUserActivity).toHaveBeenCalledWith(1);
  });

  it("a fresh sign-in (new auth_time) starts a new window even when the stored activity is stale", async () => {
    const {instance, touchUserActivity} = app({lastActivityAgoMs: minutes(30), authTimeAgoMs: 5_000});
    await request(instance).post("/api/auth/activity").set("authorization", "Bearer advisor").send({}).expect(204);
    expect(touchUserActivity).toHaveBeenCalledWith(1);
    const me = app({lastActivityAgoMs: null, authTimeAgoMs: 5_000});
    await request(me.instance).get("/api/auth/me").set("authorization", "Bearer super").expect(200);
    expect(me.touchUserActivity).toHaveBeenCalledWith(5);
  });

  it("rejects /api/auth/me (page reload) once the session is expired", async () => {
    const {instance} = app(expired);
    const response = await request(instance).get("/api/auth/me").set("authorization", "Bearer super").expect(401);
    expect(response.body.error).toBe("IDLE_EXPIRED");
  });

  it("rejects opening the SSE stream with an expired session", async () => {
    const {instance} = app(expired);
    const response = await request(instance).get("/api/delivery/events").set("authorization", "Bearer advisor");
    expect(response.status).toBe(401);
  });

  it("logout works even for an expired session, clears the anchor, revokes tokens and audits the reason", async () => {
    const {instance, clearUserActivity, revokeRefreshTokens, addAudit} = app(expired);
    await request(instance).post("/api/auth/logout").set("authorization", "Bearer advisor").send({reason: "IDLE"}).expect(204);
    expect(clearUserActivity).toHaveBeenCalledWith(1);
    expect(revokeRefreshTokens).toHaveBeenCalledWith("advisor");
    expect(addAudit).toHaveBeenCalledWith(1, "SESSION_IDLE_TIMEOUT", "user", 1, {reason: "IDLE"}, expect.anything(), expect.anything(), undefined);
  });

  it("public endpoints need no session and set no cookies", async () => {
    const {instance} = app(expired);
    const response = await request(instance).get("/api/public/site-settings").expect(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["cache-control"]).toContain("max-age=60");
  });
});

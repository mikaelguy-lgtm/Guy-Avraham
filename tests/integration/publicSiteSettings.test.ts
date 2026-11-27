import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { defaultPublicSiteSettings, parsePublicSiteSettings, type PublicSiteSettings } from "../../src/domain/publicSite";
import { EmailService } from "../../src/services/email";
import { AdvisorEmailVerificationService } from "../../src/services/emailVerification";
import { EncryptionService } from "../../src/utils/crypto";
import { env, makeStore, MemoryLimiter, MemoryStorage, secrets, verifier } from "../helpers/fakes";

// חנות מזויפת עם system_settings אמיתי-למחצה: הכתיבה נשמרת בזיכרון וניתנת לקריאה חוזרת.
function app(initial: Partial<PublicSiteSettings> = {}) {
  const rows = new Map<string, string>();
  const seed = {...defaultPublicSiteSettings(), ...initial};
  rows.set("public_whatsapp_enabled", String(seed.whatsappEnabled));
  rows.set("public_whatsapp_number", seed.whatsappNumber);
  rows.set("public_whatsapp_message", seed.whatsappMessage);
  const setSettings = vi.fn(async (_category: string, values: Record<string, string>) => { for (const [key, value] of Object.entries(values)) rows.set(key, value); });
  const addAudit = vi.fn().mockResolvedValue(undefined);
  const store = makeStore({
    setSettings,
    addAudit,
    getPublicSiteSettings: async () => parsePublicSiteSettings([...rows.entries()].map(([key, value]) => ({key, value})))
  });
  const email = {verify: vi.fn(), send: vi.fn().mockResolvedValue({messageId: "message-1"}), test: vi.fn(), reload: vi.fn(), isDeliveryActive: vi.fn().mockResolvedValue(true)} as unknown as EmailService;
  const instance = createApp({
    env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)),
    storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets, email,
    emailVerification: new AdvisorEmailVerificationService({createVerificationLink: vi.fn()}, email, store),
    passwordReset: {sendPasswordResetEmail: vi.fn().mockResolvedValue({messageId: "message-1"})},
    gemini: {analyze: vi.fn()} as never,
    firebaseAccounts: {deleteUser: vi.fn(), updateUserEmail: vi.fn(), revokeRefreshTokens: vi.fn()}
  });
  return {instance, setSettings, addAudit, rows};
}

describe("GET /api/public/site-settings", () => {
  it("is public, returns only the allow-listed keys and hides WhatsApp while the placeholder number is stored", async () => {
    const {instance} = app();
    const response = await request(instance).get("/api/public/site-settings").expect(200);
    expect(Object.keys(response.body).sort()).toEqual(["loginEnabled", "registrationEnabled", "socialLinks", "whatsappAvailable", "whatsappEnabled", "whatsappLink", "whatsappMessage"]);
    expect(response.body.whatsappAvailable).toBe(false);
    expect(response.body.whatsappLink).toBeNull();
    expect(response.body.registrationEnabled).toBe(true);
    expect(response.body.loginEnabled).toBe(true);
    const raw = JSON.stringify(response.body).toLowerCase();
    for (const forbidden of ["smtp", "password", "admin_notification_email", "secret", "000000000"]) expect(raw).not.toContain(forbidden);
  });

  it("exposes the click-to-chat link once a real number is configured", async () => {
    const {instance} = app({whatsappNumber: "972501234567"});
    const response = await request(instance).get("/api/public/site-settings").expect(200);
    expect(response.body.whatsappAvailable).toBe(true);
    expect(response.body.whatsappLink).toMatch(/^https:\/\/wa\.me\/972501234567\?text=/);
    expect(response.body.whatsappLink).not.toContain("utm_");
  });
});

describe("/api/admin/settings/public-site", () => {
  it("is SUPER_ADMIN only", async () => {
    const {instance} = app();
    for (const token of ["advisor", "lender", "admin"]) {
      await request(instance).get("/api/admin/settings/public-site").set("authorization", `Bearer ${token}`).expect(403);
      await request(instance).patch("/api/admin/settings/public-site").set("authorization", `Bearer ${token}`).send({whatsappEnabled: false}).expect(403);
    }
    await request(instance).get("/api/admin/settings/public-site").expect(401);
  });

  it("normalizes a local number to international format, takes effect immediately and audits without the number", async () => {
    const {instance, setSettings, addAudit} = app();
    const response = await request(instance).patch("/api/admin/settings/public-site").set("authorization", "Bearer super").send({whatsappNumber: "0501234567"}).expect(200);
    expect(response.body.whatsappNumber).toBe("972501234567");
    expect(setSettings).toHaveBeenCalledWith("PUBLIC_SITE", {public_whatsapp_number: "972501234567"}, 5);
    const publicView = await request(instance).get("/api/public/site-settings").expect(200);
    expect(publicView.body.whatsappAvailable).toBe(true);
    const audit = addAudit.mock.calls.find((call) => call[1] === "PUBLIC_SITE_SETTINGS_UPDATED");
    expect(audit).toBeDefined();
    expect(audit![4]).toEqual({changedFields: [{field: "public_whatsapp_number", changed: true}], toggleChanges: undefined});
    expect(JSON.stringify(audit![4])).not.toContain("9725");
    expect(JSON.stringify(audit![4])).not.toContain("0501234567");
  });

  it("rejects malformed numbers, URLs and javascript: with field errors", async () => {
    const {instance, setSettings} = app();
    for (const value of ["javascript:alert(1)", "https://wa.me/972501234567", "+1 555 123 4567", "abc", "05"]) {
      const response = await request(instance).patch("/api/admin/settings/public-site").set("authorization", "Bearer super").send({whatsappNumber: value}).expect(400);
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.fieldErrors.whatsappNumber).toBeTruthy();
    }
    expect(setSettings).not.toHaveBeenCalled();
  });

  it("audits toggles with old/new booleans and hides the button when disabled", async () => {
    const {instance, addAudit} = app({whatsappNumber: "972501234567"});
    await request(instance).patch("/api/admin/settings/public-site").set("authorization", "Bearer super").send({whatsappEnabled: false, registrationEnabled: false}).expect(200);
    const audit = addAudit.mock.calls.find((call) => call[1] === "PUBLIC_SITE_SETTINGS_UPDATED");
    expect(audit![4]).toEqual({changedFields: undefined, toggleChanges: {public_whatsapp_enabled: {old: true, new: false}, public_registration_cta_enabled: {old: true, new: false}}});
    const publicView = await request(instance).get("/api/public/site-settings").expect(200);
    expect(publicView.body.whatsappAvailable).toBe(false);
    expect(publicView.body.whatsappLink).toBeNull();
    expect(publicView.body.registrationEnabled).toBe(false);
  });

  it("validates social links per network and hides empty ones", async () => {
    const {instance} = app();
    const bad = await request(instance).patch("/api/admin/settings/public-site").set("authorization", "Bearer super").send({socialLinks: {facebook: "http://facebook.com/x", instagram: "https://not-instagram.example/"}}).expect(400);
    expect(Object.keys(bad.body.fieldErrors).sort()).toEqual(["socialLinks.facebook", "socialLinks.instagram"]);
    const ok = await request(instance).patch("/api/admin/settings/public-site").set("authorization", "Bearer super").send({socialLinks: {facebook: "https://www.facebook.com/syncash", youtube: null}}).expect(200);
    expect(ok.body.socialLinks.facebook).toBe("https://www.facebook.com/syncash");
    expect(ok.body.socialLinks.youtube).toBeNull();
    const publicView = await request(instance).get("/api/public/site-settings").expect(200);
    expect(publicView.body.socialLinks).toEqual({facebook: "https://www.facebook.com/syncash", linkedin: null, instagram: null, youtube: null});
  });

  it("rejects unknown fields (no SEO/content fields are accepted)", async () => {
    const {instance} = app();
    await request(instance).patch("/api/admin/settings/public-site").set("authorization", "Bearer super").send({seoTitle: "x"}).expect(400);
  });
});

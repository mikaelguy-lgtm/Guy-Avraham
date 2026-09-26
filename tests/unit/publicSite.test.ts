import { describe, expect, it } from "vitest";
import {
  applyPublicSiteSettingsPatch, buildWhatsAppLink, defaultPublicSiteSettings, isWhatsAppAvailable, normalizeIsraeliPhone,
  parsePublicSiteSettings, PLACEHOLDER_WHATSAPP_NUMBER, toPublicSitePayload, validateSocialLink
} from "../../src/domain/publicSite";

describe("normalizeIsraeliPhone", () => {
  it("normalizes a local mobile number to international digits", () => {
    expect(normalizeIsraeliPhone("0501234567")).toEqual({ok: true, digits: "972501234567"});
    expect(normalizeIsraeliPhone("050-123 4567")).toEqual({ok: true, digits: "972501234567"});
    expect(normalizeIsraeliPhone("+972 50 123 4567")).toEqual({ok: true, digits: "972501234567"});
    expect(normalizeIsraeliPhone("972501234567")).toEqual({ok: true, digits: "972501234567"});
    expect(normalizeIsraeliPhone("03-1234567")).toEqual({ok: true, digits: "97231234567"});
  });
  it("keeps the placeholder as-is", () => {
    expect(normalizeIsraeliPhone(PLACEHOLDER_WHATSAPP_NUMBER)).toEqual({ok: true, digits: PLACEHOLDER_WHATSAPP_NUMBER});
  });
  it("rejects malformed input, URLs and javascript:", () => {
    expect(normalizeIsraeliPhone("")).toEqual({ok: false, reason: "EMPTY"});
    expect(normalizeIsraeliPhone("javascript:alert(1)").ok).toBe(false);
    expect(normalizeIsraeliPhone("https://wa.me/972501234567").ok).toBe(false);
    expect(normalizeIsraeliPhone("050123456a").ok).toBe(false);
    expect(normalizeIsraeliPhone("+1 555 123 4567")).toEqual({ok: false, reason: "NOT_ISRAELI"});
    expect(normalizeIsraeliPhone("05012").ok).toBe(false);
  });
});

describe("WhatsApp availability and link", () => {
  it("is unavailable with the placeholder number or when disabled", () => {
    expect(isWhatsAppAvailable({whatsappEnabled: true, whatsappNumber: PLACEHOLDER_WHATSAPP_NUMBER})).toBe(false);
    expect(isWhatsAppAvailable({whatsappEnabled: true, whatsappNumber: ""})).toBe(false);
    expect(isWhatsAppAvailable({whatsappEnabled: false, whatsappNumber: "972501234567"})).toBe(false);
    expect(isWhatsAppAvailable({whatsappEnabled: true, whatsappNumber: "972501234567"})).toBe(true);
  });
  it("builds a standard click-to-chat link with only the encoded message", () => {
    const link = buildWhatsAppLink("972501234567", "שלום, הגעתי דרך אתר SynCash ורציתי לקבל פרטים נוספים.");
    expect(link.startsWith("https://wa.me/972501234567?text=")).toBe(true);
    expect(link).not.toContain("utm_");
    expect(decodeURIComponent(link.split("text=")[1])).toBe("שלום, הגעתי דרך אתר SynCash ורציתי לקבל פרטים נוספים.");
  });
});

describe("public payload allow-list", () => {
  it("exposes exactly the public keys and never the raw number", () => {
    const payload = toPublicSitePayload({...defaultPublicSiteSettings(), whatsappNumber: "972501234567"});
    expect(Object.keys(payload).sort()).toEqual(["loginEnabled", "registrationEnabled", "socialLinks", "whatsappAvailable", "whatsappEnabled", "whatsappLink", "whatsappMessage"]);
    expect(JSON.stringify(payload)).not.toContain("\"whatsappNumber\"");
    expect(payload.whatsappAvailable).toBe(true);
    expect(payload.whatsappLink).toContain("wa.me/972501234567");
  });
  it("hides the link while the placeholder is stored", () => {
    const payload = toPublicSitePayload(defaultPublicSiteSettings());
    expect(payload.whatsappAvailable).toBe(false);
    expect(payload.whatsappLink).toBeNull();
    expect(payload.registrationEnabled).toBe(true);
    expect(payload.loginEnabled).toBe(true);
  });
});

describe("social links", () => {
  it("accepts only https links on the matching network host", () => {
    expect(validateSocialLink("facebook", "https://www.facebook.com/syncash")).toBe("https://www.facebook.com/syncash");
    expect(validateSocialLink("youtube", "https://youtu.be/abc")).toBe("https://youtu.be/abc");
    expect(validateSocialLink("linkedin", "http://www.linkedin.com/company/x")).toBeUndefined();
    expect(validateSocialLink("instagram", "https://evil.example/instagram.com")).toBeUndefined();
    expect(validateSocialLink("facebook", "javascript:alert(1)")).toBeUndefined();
    expect(validateSocialLink("facebook", "")).toBeNull();
    expect(validateSocialLink("facebook", null)).toBeNull();
  });
});

describe("applyPublicSiteSettingsPatch + parse", () => {
  it("normalizes the number, records privacy-safe audit data and round-trips through settings rows", () => {
    const current = defaultPublicSiteSettings();
    const result = applyPublicSiteSettingsPatch(current, {whatsappNumber: "0501234567", whatsappEnabled: false, socialLinks: {facebook: "https://facebook.com/syncash", youtube: ""}});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.public_whatsapp_number).toBe("972501234567");
    expect(result.values.public_whatsapp_enabled).toBe("false");
    expect(result.values.public_social_facebook).toBe("https://facebook.com/syncash");
    expect(result.values.public_social_youtube).toBe("");
    expect(result.changedFields).toEqual(["public_whatsapp_number", "public_social_facebook"]);
    expect(result.toggleChanges).toEqual({public_whatsapp_enabled: {old: true, new: false}});
    expect(JSON.stringify(result.changedFields)).not.toContain("9725");

    const parsed = parsePublicSiteSettings(Object.entries(result.values).map(([key, value]) => ({key, value})));
    expect(parsed.whatsappNumber).toBe("972501234567");
    expect(parsed.whatsappEnabled).toBe(false);
    expect(parsed.socialLinks.facebook).toBe("https://facebook.com/syncash");
    expect(parsed.socialLinks.youtube).toBeNull();
  });
  it("rejects invalid numbers, link-bearing messages and bad social links with field errors", () => {
    const result = applyPublicSiteSettingsPatch(defaultPublicSiteSettings(), {whatsappNumber: "javascript:1", whatsappMessage: "בקרו ב-https://x.y", socialLinks: {linkedin: "ftp://linkedin.com"}});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["socialLinks.linkedin", "whatsappMessage", "whatsappNumber"]);
  });
});

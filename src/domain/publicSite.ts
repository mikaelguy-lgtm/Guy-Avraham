// הגדרות האתר הציבורי (syncash.co.il) שנשמרות ב-system_settings תחת קטגוריה אחת.
// המודול טהור (ללא DB) כדי שאותה לוגיקת אימות/נרמול תשמש את השרת ואת הבדיקות.

export const PUBLIC_SITE_CATEGORY = "PUBLIC_SITE";
// מספר זמני: כל עוד זה הערך השמור, כפתור ה-WhatsApp מוסתר באתר.
export const PLACEHOLDER_WHATSAPP_NUMBER = "000000000";
export const DEFAULT_WHATSAPP_MESSAGE = "שלום, הגעתי דרך אתר SynCash ורציתי לקבל פרטים נוספים.";
export const MAX_WHATSAPP_MESSAGE_LENGTH = 300;

export const PUBLIC_SITE_KEYS = {
  whatsappEnabled: "public_whatsapp_enabled",
  whatsappNumber: "public_whatsapp_number",
  whatsappMessage: "public_whatsapp_message",
  registrationEnabled: "public_registration_cta_enabled",
  loginEnabled: "public_login_cta_enabled",
  socialFacebook: "public_social_facebook",
  socialLinkedin: "public_social_linkedin",
  socialInstagram: "public_social_instagram",
  socialYoutube: "public_social_youtube"
} as const;

export type SocialNetwork = "facebook" | "linkedin" | "instagram" | "youtube";
export type SocialLinks = Record<SocialNetwork, string | null>;

// המצב המלא כפי שה-SUPER_ADMIN רואה ועורך אותו.
export interface PublicSiteSettings {
  whatsappEnabled: boolean;
  whatsappNumber: string; // ספרות בלבד בפורמט בינלאומי (9725...) או המספר הזמני
  whatsappMessage: string;
  registrationEnabled: boolean;
  loginEnabled: boolean;
  socialLinks: SocialLinks;
}

// הרשימה הסגורה של מה שהאתר הציבורי מקבל. שום דבר מעבר לזה לא יוצא החוצה.
export interface PublicSitePayload {
  whatsappEnabled: boolean;
  whatsappAvailable: boolean;
  whatsappLink: string | null;
  whatsappMessage: string;
  registrationEnabled: boolean;
  loginEnabled: boolean;
  socialLinks: SocialLinks;
}

export interface PublicSiteSettingsPatch {
  whatsappEnabled?: boolean;
  whatsappNumber?: string;
  whatsappMessage?: string;
  registrationEnabled?: boolean;
  loginEnabled?: boolean;
  socialLinks?: Partial<Record<SocialNetwork, string | null>>;
}

export type PhoneNormalization = {ok: true; digits: string} | {ok: false; reason: "EMPTY" | "NOT_DIGITS" | "NOT_ISRAELI"};

// מנרמל מספר ישראלי לפורמט בינלאומי ללא '+' (למשל 0501234567 -> 972501234567).
// מקבל רק ספרות (עם רווחים/מקפים/סוגריים/'+' מוביל שמנוקים). כל דבר אחר נדחה.
export function normalizeIsraeliPhone(input: string): PhoneNormalization {
  const trimmed = input.trim();
  if (!trimmed) return {ok: false, reason: "EMPTY"};
  const stripped = trimmed.replace(/^\+/, "").replace(/[\s\-().]/g, "");
  if (!/^\d+$/.test(stripped)) return {ok: false, reason: "NOT_DIGITS"};
  if (stripped === PLACEHOLDER_WHATSAPP_NUMBER) return {ok: true, digits: PLACEHOLDER_WHATSAPP_NUMBER};
  // מקומי: 0 ואחריו 8 או 9 ספרות (נייד 05X-XXXXXXX, נייח 0X-XXXXXXX)
  if (/^0\d{8,9}$/.test(stripped)) return {ok: true, digits: `972${stripped.slice(1)}`};
  // בינלאומי: 972 ואחריו 8 או 9 ספרות (ללא ה-0 המוביל)
  if (/^972[1-9]\d{7,8}$/.test(stripped)) return {ok: true, digits: stripped};
  return {ok: false, reason: "NOT_ISRAELI"};
}

export function isPlaceholderNumber(digits: string): boolean {
  return !digits || digits === PLACEHOLDER_WHATSAPP_NUMBER;
}

export function isWhatsAppAvailable(settings: Pick<PublicSiteSettings, "whatsappEnabled" | "whatsappNumber">): boolean {
  if (!settings.whatsappEnabled || isPlaceholderNumber(settings.whatsappNumber)) return false;
  const normalized = normalizeIsraeliPhone(settings.whatsappNumber);
  return normalized.ok && !isPlaceholderNumber(normalized.digits);
}

// קישור click-to-chat תקני. ההודעה מקודדת; אין פרמטרי מעקב, אין כתובת עמוד.
export function buildWhatsAppLink(digits: string, message: string): string {
  const text = message.trim().slice(0, MAX_WHATSAPP_MESSAGE_LENGTH);
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const SOCIAL_HOSTS: Record<SocialNetwork, string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"],
  linkedin: ["linkedin.com", "www.linkedin.com", "il.linkedin.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"]
};

// מאמת קישור רשת חברתית: https בלבד, מארח מהרשימה הסגורה של אותה רשת, ללא credentials.
// ערך ריק/null מוחזר כ-null (הקישור מוסתר באתר). ערך לא תקין -> undefined (שגיאת אימות).
export function validateSocialLink(network: SocialNetwork, value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 300) return undefined;
  let url: URL;
  try { url = new URL(trimmed); } catch { return undefined; }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  if (!SOCIAL_HOSTS[network].includes(url.hostname.toLowerCase())) return undefined;
  return url.toString();
}

export function sanitizeWhatsAppMessage(value: string): string | undefined {
  // תווי בקרה (0x00–0x1f, 0x7f) מוחלפים ברווח בלי regex של control chars (כלל lint)
  const cleaned = Array.from(value, (char) => { const code = char.charCodeAt(0); return code < 0x20 || code === 0x7f ? " " : char; }).join("").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > MAX_WHATSAPP_MESSAGE_LENGTH) return undefined;
  if (/https?:\/\/|javascript:|<\s*\w/i.test(cleaned)) return undefined;
  return cleaned;
}

export function defaultPublicSiteSettings(): PublicSiteSettings {
  return {
    whatsappEnabled: true,
    whatsappNumber: PLACEHOLDER_WHATSAPP_NUMBER,
    whatsappMessage: DEFAULT_WHATSAPP_MESSAGE,
    registrationEnabled: true,
    loginEnabled: true,
    socialLinks: {facebook: null, linkedin: null, instagram: null, youtube: null}
  };
}

// בונה את מצב ההגדרות משורות system_settings (key/value). ערכים חסרים מקבלים ברירת מחדל.
export function parsePublicSiteSettings(rows: Array<{key: string; value: string | null}>): PublicSiteSettings {
  const defaults = defaultPublicSiteSettings();
  const value = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
  const flag = (key: string, fallback: boolean) => { const raw = value(key); return raw === null ? fallback : raw === "true"; };
  const text = (key: string, fallback: string) => { const raw = value(key); return raw === null || raw.trim() === "" ? fallback : raw; };
  const social = (network: SocialNetwork, key: string) => validateSocialLink(network, value(key)) ?? null;
  return {
    whatsappEnabled: flag(PUBLIC_SITE_KEYS.whatsappEnabled, defaults.whatsappEnabled),
    whatsappNumber: text(PUBLIC_SITE_KEYS.whatsappNumber, defaults.whatsappNumber),
    whatsappMessage: text(PUBLIC_SITE_KEYS.whatsappMessage, defaults.whatsappMessage),
    registrationEnabled: flag(PUBLIC_SITE_KEYS.registrationEnabled, defaults.registrationEnabled),
    loginEnabled: flag(PUBLIC_SITE_KEYS.loginEnabled, defaults.loginEnabled),
    socialLinks: {
      facebook: social("facebook", PUBLIC_SITE_KEYS.socialFacebook),
      linkedin: social("linkedin", PUBLIC_SITE_KEYS.socialLinkedin),
      instagram: social("instagram", PUBLIC_SITE_KEYS.socialInstagram),
      youtube: social("youtube", PUBLIC_SITE_KEYS.socialYoutube)
    }
  };
}

// ההמרה היחידה לעולם החיצון: allow-list מפורש, המספר עצמו לעולם לא נשלח כשדה נפרד.
export function toPublicSitePayload(settings: PublicSiteSettings): PublicSitePayload {
  const available = isWhatsAppAvailable(settings);
  const normalized = available ? normalizeIsraeliPhone(settings.whatsappNumber) : null;
  return {
    whatsappEnabled: settings.whatsappEnabled,
    whatsappAvailable: available,
    whatsappLink: available && normalized?.ok ? buildWhatsAppLink(normalized.digits, settings.whatsappMessage) : null,
    whatsappMessage: settings.whatsappMessage,
    registrationEnabled: settings.registrationEnabled,
    loginEnabled: settings.loginEnabled,
    socialLinks: {...settings.socialLinks}
  };
}

export type PatchValidation =
  | {ok: true; values: Record<string, string>; changedFields: string[]; toggleChanges: Record<string, {old: boolean; new: boolean}>}
  | {ok: false; fieldErrors: Record<string, string>};

// ממיר עדכון חלקי לשורות system_settings לשמירה, אחרי אימות ונרמול.
// מחזיר גם את פרטי ה-audit לפי מדיניות הפרטיות: טוגלים עם ערך ישן/חדש, כל השאר {changed: true} בלבד.
export function applyPublicSiteSettingsPatch(current: PublicSiteSettings, patch: PublicSiteSettingsPatch): PatchValidation {
  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  const changedFields: string[] = [];
  const toggleChanges: Record<string, {old: boolean; new: boolean}> = {};

  const toggle = (name: "whatsappEnabled" | "registrationEnabled" | "loginEnabled", key: string) => {
    const next = patch[name];
    if (next === undefined) return;
    values[key] = String(next);
    if (next !== current[name]) toggleChanges[key] = {old: current[name], new: next};
  };
  toggle("whatsappEnabled", PUBLIC_SITE_KEYS.whatsappEnabled);
  toggle("registrationEnabled", PUBLIC_SITE_KEYS.registrationEnabled);
  toggle("loginEnabled", PUBLIC_SITE_KEYS.loginEnabled);

  if (patch.whatsappNumber !== undefined) {
    const normalized = normalizeIsraeliPhone(patch.whatsappNumber);
    if (!normalized.ok) fieldErrors.whatsappNumber = normalized.reason === "EMPTY" ? "יש להזין מספר טלפון." : normalized.reason === "NOT_DIGITS" ? "המספר יכול להכיל ספרות בלבד." : "יש להזין מספר ישראלי תקין (למשל 0501234567).";
    else {
      values[PUBLIC_SITE_KEYS.whatsappNumber] = normalized.digits;
      if (normalized.digits !== current.whatsappNumber) changedFields.push(PUBLIC_SITE_KEYS.whatsappNumber);
    }
  }
  if (patch.whatsappMessage !== undefined) {
    const message = sanitizeWhatsAppMessage(patch.whatsappMessage);
    if (message === undefined) fieldErrors.whatsappMessage = `ההודעה חייבת להיות טקסט בלבד, עד ${MAX_WHATSAPP_MESSAGE_LENGTH} תווים, ללא קישורים.`;
    else {
      values[PUBLIC_SITE_KEYS.whatsappMessage] = message;
      if (message !== current.whatsappMessage) changedFields.push(PUBLIC_SITE_KEYS.whatsappMessage);
    }
  }
  if (patch.socialLinks) {
    const keys: Record<SocialNetwork, string> = {facebook: PUBLIC_SITE_KEYS.socialFacebook, linkedin: PUBLIC_SITE_KEYS.socialLinkedin, instagram: PUBLIC_SITE_KEYS.socialInstagram, youtube: PUBLIC_SITE_KEYS.socialYoutube};
    for (const network of Object.keys(keys) as SocialNetwork[]) {
      if (!(network in patch.socialLinks)) continue;
      const validated = validateSocialLink(network, patch.socialLinks[network]);
      if (validated === undefined) { fieldErrors[`socialLinks.${network}`] = "יש להזין קישור https מלא לרשת הזו, או להשאיר ריק."; continue; }
      values[keys[network]] = validated ?? "";
      if ((validated ?? null) !== current.socialLinks[network]) changedFields.push(keys[network]);
    }
  }

  if (Object.keys(fieldErrors).length > 0) return {ok: false, fieldErrors};
  return {ok: true, values, changedFields, toggleChanges};
}

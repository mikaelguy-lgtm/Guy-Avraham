import type { Auth } from "firebase-admin/auth";
import { sanitizeSmtpFailure, type EmailService } from "./email.js";

export const ADVISOR_EMAIL_VERIFICATION_TEMPLATE = "ADVISOR_EMAIL_VERIFICATION";

export interface VerificationLinkProvider {
  createVerificationLink(email: string): Promise<{url: string; expiresAt?: Date}>;
}

abstract class FirebaseVerificationLinkProvider implements VerificationLinkProvider {
  constructor(private readonly auth: Auth, private readonly appUrl: string) {}

  async createVerificationLink(email: string): Promise<{url: string}> {
    const continueUrl = new URL("/verify-email", this.appUrl).toString();
    const url = await this.auth.generateEmailVerificationLink(email, {url: continueUrl});
    return {url};
  }
}

export class ProductionFirebaseVerificationLinkProvider extends FirebaseVerificationLinkProvider {}
export class EmulatorFirebaseVerificationLinkProvider extends FirebaseVerificationLinkProvider {}

export interface VerificationEmailLogStore {
  addEmailLog(values: {
    recipient: string;
    template?: string;
    userId?: number;
    requestId?: string;
    messageId?: string;
    status: "SENT" | "FAILED";
    sanitizedError?: string;
  }): Promise<void>;
}

export interface EmailVerificationService {
  sendVerificationEmail(user: {
    firebaseUid: string;
    email: string;
    displayName?: string;
  }, context?: {userId?: number; requestId?: string}): Promise<{
    messageId: string;
    expiresAt?: Date;
  }>;
}

export class EmailVerificationDeliveryError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function verificationEmail(displayName: string, url: string): {subject: string; html: string; text: string} {
  const safeName = escapeHtml(displayName || "יועץ/ת");
  const safeUrl = escapeHtml(url);
  const subject = "אימות כתובת הדוא״ל שלך – SynCash";
  const text = `שלום ${displayName || "יועץ/ת"},\n\nתודה שנרשמת ל-SynCash.\n\nכדי להפעיל את חשבון היועץ שלך, יש לאמת את כתובת הדוא״ל בקישור הבא:\n${url}\n\nהקישור מוגבל בזמן.\n\nאם לא ביצעת את ההרשמה, ניתן להתעלם מהודעה זו.`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#050b18;color:#f8fafc;font-family:Arial,sans-serif;direction:rtl"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050b18;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0d1729;border:1px solid #24334d;border-radius:18px;padding:28px"><tr><td align="center" style="padding-bottom:22px"><div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:16px;background:#d4af37;color:#07101f;font-size:28px;font-weight:900">S</div><div style="margin-top:10px;letter-spacing:5px;color:#f8fafc;font-weight:800">SYNCASH</div></td></tr><tr><td style="font-size:17px;line-height:1.75;text-align:right"><p>שלום ${safeName},</p><p>תודה שנרשמת ל־SynCash.</p><p>כדי להפעיל את חשבון היועץ שלך, יש לאמת את כתובת הדוא״ל באמצעות הכפתור הבא:</p><p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:10px">אימות כתובת הדוא״ל</a></p><p style="color:#cbd5e1">הקישור מוגבל בזמן.</p><p style="color:#94a3b8;font-size:14px">אם לא ביצעת את ההרשמה, ניתן להתעלם מהודעה זו.</p></td></tr></table></td></tr></table></body></html>`;
  return {subject, html, text};
}

export class AdvisorEmailVerificationService implements EmailVerificationService {
  constructor(
    private readonly links: VerificationLinkProvider,
    private readonly email: EmailService,
    private readonly logs: VerificationEmailLogStore
  ) {}

  async sendVerificationEmail(user: {firebaseUid: string; email: string; displayName?: string}, context: {userId?: number; requestId?: string} = {}) {
    try {
      const link = await this.links.createVerificationLink(user.email);
      const content = verificationEmail(user.displayName ?? "", link.url);
      const result = await this.email.send(user.email, content.subject, content.html, {text: content.text, verifyTransport: true});
      await this.logs.addEmailLog({
        recipient: user.email,
        template: ADVISOR_EMAIL_VERIFICATION_TEMPLATE,
        userId: context.userId,
        requestId: context.requestId,
        messageId: result.messageId,
        status: "SENT"
      });
      return {messageId: result.messageId, expiresAt: link.expiresAt};
    } catch (error) {
      const smtpFailure = sanitizeSmtpFailure(error);
      const linkFailure = smtpFailure.code === "SMTP_TEST_FAILED";
      const failure = linkFailure ? {code: "VERIFICATION_LINK_OR_DELIVERY_FAILED", status: 502} : smtpFailure;
      await this.logs.addEmailLog({
        recipient: user.email,
        template: ADVISOR_EMAIL_VERIFICATION_TEMPLATE,
        userId: context.userId,
        requestId: context.requestId,
        status: "FAILED",
        sanitizedError: failure.code
      }).catch(() => undefined);
      throw new EmailVerificationDeliveryError(failure.code, failure.status);
    }
  }
}

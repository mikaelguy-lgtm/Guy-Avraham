import type { Auth } from "firebase-admin/auth";
import { sanitizeSmtpFailure, type EmailService } from "./email.js";

export const ADVISOR_PASSWORD_RESET_TEMPLATE = "ADVISOR_PASSWORD_RESET";

export interface PasswordResetLinkProvider {
  createPasswordResetLink(email: string): Promise<{url: string}>;
}

abstract class FirebasePasswordResetLinkProvider implements PasswordResetLinkProvider {
  constructor(private readonly auth: Auth, private readonly appUrl: string) {}

  async createPasswordResetLink(email: string): Promise<{url: string}> {
    const continueUrl = new URL("/login", this.appUrl).toString();
    const url = await this.auth.generatePasswordResetLink(email, {url: continueUrl});
    return {url};
  }
}

export class ProductionFirebasePasswordResetLinkProvider extends FirebasePasswordResetLinkProvider {}
export class EmulatorFirebasePasswordResetLinkProvider extends FirebasePasswordResetLinkProvider {}

export interface PasswordResetEmailLogStore {
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

export class PasswordResetDeliveryError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

export interface PasswordResetService {
  sendPasswordResetEmail(target: { email: string; userId?: number }, context?: { requestId?: string }): Promise<{ messageId: string }>;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function passwordResetEmail(url: string): { subject: string; html: string; text: string } {
  const safeUrl = escapeHtml(url);
  const subject = "איפוס סיסמה – SynCash";
  const text = `שלום,\n\nהתקבלה בקשה לאיפוס הסיסמה לחשבון SynCash שלך.\n\nלאיפוס הסיסמה יש להיכנס לקישור הבא:\n${url}\n\nהקישור מוגבל בזמן. אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו — הסיסמה הנוכחית תישאר בתוקף.`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#050b18;color:#f8fafc;font-family:Arial,sans-serif;direction:rtl"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050b18;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0d1729;border:1px solid #24334d;border-radius:18px;padding:28px"><tr><td align="center" style="padding-bottom:22px"><div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:16px;background:#d4af37;color:#07101f;font-size:28px;font-weight:900">S</div><div style="margin-top:10px;letter-spacing:5px;color:#f8fafc;font-weight:800">SYNCASH</div></td></tr><tr><td style="font-size:17px;line-height:1.75;text-align:right"><p>שלום,</p><p>התקבלה בקשה לאיפוס הסיסמה לחשבון SynCash שלך.</p><p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:10px">איפוס סיסמה</a></p><p style="color:#cbd5e1">הקישור מוגבל בזמן.</p><p style="color:#94a3b8;font-size:14px">אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו — הסיסמה הנוכחית תישאר בתוקף.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

export class AdvisorPasswordResetService implements PasswordResetService {
  constructor(
    private readonly links: PasswordResetLinkProvider,
    private readonly email: EmailService,
    private readonly logs: PasswordResetEmailLogStore
  ) {}

  async sendPasswordResetEmail(target: { email: string; userId?: number }, context: { requestId?: string } = {}): Promise<{ messageId: string }> {
    try {
      const link = await this.links.createPasswordResetLink(target.email);
      const content = passwordResetEmail(link.url);
      const result = await this.email.send(target.email, content.subject, content.html, { text: content.text });
      await this.logs.addEmailLog({
        recipient: target.email,
        template: ADVISOR_PASSWORD_RESET_TEMPLATE,
        userId: target.userId,
        requestId: context.requestId,
        messageId: result.messageId,
        status: "SENT"
      });
      return { messageId: result.messageId };
    } catch (error) {
      const failure = sanitizeSmtpFailure(error);
      await this.logs.addEmailLog({
        recipient: target.email,
        template: ADVISOR_PASSWORD_RESET_TEMPLATE,
        userId: target.userId,
        requestId: context.requestId,
        status: "FAILED",
        sanitizedError: failure.code
      }).catch(() => undefined);
      throw new PasswordResetDeliveryError(failure.code, failure.status);
    }
  }
}

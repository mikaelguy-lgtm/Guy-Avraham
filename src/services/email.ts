import nodemailer, { type Transporter } from "nodemailer";
import type { AppEnv } from "../config/env.js";
import type { SecretProvider } from "../utils/secretManager.js";

export interface EmailResult { messageId: string; }
export interface EmailSendOptions { text?: string; verifyTransport?: boolean; }
export type SmtpSettings = Record<string, string | null>;

export function resolveSmtpTransportSettings(env: AppEnv, settings: SmtpSettings, password: string | null) {
  const port = Number(settings.SMTP_PORT ?? env.SMTP_PORT);
  const secure = settings.SMTP_SECURE ? settings.SMTP_SECURE === "true" : env.SMTP_SECURE;
  const user = settings.SMTP_USER ?? env.SMTP_USER;
  const requireTLS = !secure && port === 587;
  return {
    host: settings.SMTP_HOST ?? env.SMTP_HOST,
    port,
    secure,
    requireTLS,
    tls: requireTLS ? {minVersion: "TLSv1.2" as const} : undefined,
    auth: user ? {user, pass: password!} : undefined,
    disableFileAccess: true,
    disableUrlAccess: true
  };
}

export class SmtpServiceError extends Error {
  constructor(readonly code: "SMTP_PASSWORD_NOT_CONFIGURED") {
    super(code);
  }
}

export interface SanitizedSmtpFailure {
  code: string;
  message: string;
  status: number;
}

export class EmailService {
  private cachedSettings: SmtpSettings | null = null;

  constructor(
    private readonly env: AppEnv,
    private readonly secrets: SecretProvider,
    private readonly settingsProvider: () => Promise<SmtpSettings> = async () => ({})
  ) {}

  private async settings(): Promise<SmtpSettings> {
    if (!this.cachedSettings) this.cachedSettings = await this.settingsProvider();
    return this.cachedSettings;
  }

  async reload(): Promise<void> {
    this.cachedSettings = await this.settingsProvider();
  }

  private async transporter(): Promise<Transporter> {
    const password = await this.secrets.getSecret("syncash-smtp-password");
    const settings = await this.settings();
    const user = settings.SMTP_USER ?? this.env.SMTP_USER;
    if (user && !password) throw new SmtpServiceError("SMTP_PASSWORD_NOT_CONFIGURED");
    return nodemailer.createTransport(resolveSmtpTransportSettings(this.env, settings, password));
  }

  async verify(): Promise<void> {
    await (await this.transporter()).verify();
  }

  async send(to: string, subject: string, html: string, options: EmailSendOptions = {}): Promise<EmailResult> {
    const settings = await this.settings();
    const transport = await this.transporter();
    if (options.verifyTransport) await transport.verify();
    const info = await transport.sendMail({
      from: {name: settings.EMAIL_FROM_NAME ?? this.env.EMAIL_FROM_NAME, address: settings.EMAIL_FROM ?? this.env.EMAIL_FROM},
      replyTo: settings.EMAIL_REPLY_TO ?? this.env.EMAIL_REPLY_TO,
      to,
      subject,
      html,
      text: options.text
    });
    return {messageId: sanitizeMessageId(info.messageId)};
  }

  async test(to: string): Promise<EmailResult> {
    await this.reload();
    const settings = await this.settings();
    const transport = await this.transporter();
    await transport.verify();
    const info = await transport.sendMail({
      from: {name: settings.EMAIL_FROM_NAME ?? this.env.EMAIL_FROM_NAME, address: settings.EMAIL_FROM ?? this.env.EMAIL_FROM},
      replyTo: settings.EMAIL_REPLY_TO ?? this.env.EMAIL_REPLY_TO,
      to,
      subject: "SynCash SMTP test",
      html: "<p>SMTP configuration is working.</p>"
    });
    return {messageId: sanitizeMessageId(info.messageId)};
  }
}

export function sanitizeMessageId(messageId: string): string {
  return messageId.replace(/[^\x21-\x7e]/g, "").slice(0, 255);
}

export function sanitizeSmtpFailure(error: unknown): SanitizedSmtpFailure {
  if (error instanceof SmtpServiceError && error.code === "SMTP_PASSWORD_NOT_CONFIGURED") {
    return {code: "SMTP_CREDENTIAL_NOT_CONFIGURED", message: "לא הוגדרה סיסמת SMTP.", status: 409};
  }
  const details = typeof error === "object" && error !== null ? error as {code?: unknown; responseCode?: unknown} : {};
  const code = String(details.code ?? "");
  const responseCode = Number(details.responseCode ?? 0);
  if (code === "EAUTH" || responseCode === 535) {
    return {code: "SMTP_AUTH_FAILED", message: "האימות מול שרת ה-SMTP נכשל. יש לבדוק את שם המשתמש וסיסמת האפליקציה.", status: 502};
  }
  if (["ECONNECTION", "ECONNREFUSED", "ETIMEDOUT", "EDNS"].includes(code)) {
    return {code: "SMTP_CONNECTION_FAILED", message: "לא ניתן להתחבר לשרת ה-SMTP.", status: 502};
  }
  if (code === "ETLS") {
    return {code: "SMTP_TLS_FAILED", message: "יצירת חיבור STARTTLS מאובטח נכשלה.", status: 502};
  }
  return {code: "SMTP_TEST_FAILED", message: "בדיקת ה-SMTP נכשלה.", status: 502};
}

export function sanitizeEmailError(): string {
  return "Email delivery failed";
}

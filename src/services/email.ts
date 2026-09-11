import nodemailer, { type Transporter } from "nodemailer";
import type { AppEnv } from "../config/env.js";
import type { SecretProvider } from "../utils/secretManager.js";

export interface EmailResult { messageId: string; }
export interface EmailSendOptions { text?: string; verifyTransport?: boolean; }
export type SmtpSettings = Record<string, string | null>;

type SecurityMode = "NONE" | "STARTTLS" | "TLS";

function securityMode(env: AppEnv, settings: SmtpSettings, port: number): SecurityMode {
  const configured = settings.SMTP_SECURITY_MODE;
  if (configured === "NONE" || configured === "STARTTLS" || configured === "TLS") return configured;
  const secure = settings.SMTP_SECURE ? settings.SMTP_SECURE === "true" : env.SMTP_SECURE;
  if (secure) return "TLS";
  return port === 587 ? "STARTTLS" : "NONE";
}

export function resolveSmtpTransportSettings(env: AppEnv, settings: SmtpSettings, password: string | null) {
  const port = Number(settings.SMTP_PORT ?? env.SMTP_PORT);
  const mode = securityMode(env, settings, port);
  const user = settings.SMTP_USER ?? env.SMTP_USER;
  const requireTLS = mode === "STARTTLS";
  return {
    host: settings.SMTP_HOST ?? env.SMTP_HOST,
    port,
    secure: mode === "TLS",
    requireTLS,
    ignoreTLS: mode === "NONE",
    tls: mode === "NONE" ? undefined : {minVersion: "TLSv1.2" as const},
    auth: user ? {user, pass: password!} : undefined,
    disableFileAccess: true,
    disableUrlAccess: true
  };
}

export class SmtpServiceError extends Error {
  constructor(readonly code: "SMTP_PASSWORD_NOT_CONFIGURED" | "EMAIL_DELIVERY_DISABLED" | "EMAIL_CONFIGURATION_NOT_ACTIVE") {
    super(code);
  }
}

export interface SanitizedSmtpFailure {
  code: string;
  message: string;
  status: number;
}

export class EmailService {
  constructor(
    private readonly env: AppEnv,
    private readonly secrets: SecretProvider,
    private readonly settingsProvider: () => Promise<SmtpSettings> = async () => ({})
  ) {}

  private async settings(): Promise<SmtpSettings> {
    return this.settingsProvider();
  }

  async reload(): Promise<void> {
    await this.settingsProvider();
  }

  async isDeliveryActive(): Promise<boolean> {
    const settings = await this.settings();
    if (settings.SMTP_CONFIGURATION_STATUS) return settings.SMTP_CONFIGURATION_STATUS === "ACTIVE";
    return this.env.EMAIL_DELIVERY_ENABLED;
  }

  private async transporter(settings: SmtpSettings, allowInactive = false): Promise<Transporter> {
    const hasVersionedConfiguration = Boolean(settings.SMTP_CONFIGURATION_STATUS);
    if (!allowInactive && hasVersionedConfiguration && settings.SMTP_CONFIGURATION_STATUS !== "ACTIVE") {
      throw new SmtpServiceError("EMAIL_CONFIGURATION_NOT_ACTIVE");
    }
    if (!allowInactive && !hasVersionedConfiguration && !this.env.EMAIL_DELIVERY_ENABLED) {
      throw new SmtpServiceError("EMAIL_DELIVERY_DISABLED");
    }
    const secretName = settings.SMTP_SECRET_NAME || "syncash-smtp-password";
    const secretVersion = settings.SMTP_SECRET_VERSION || null;
    const password = await this.secrets.getSecret(secretName, secretVersion);
    const user = settings.SMTP_USER ?? this.env.SMTP_USER;
    if (user && !password) throw new SmtpServiceError("SMTP_PASSWORD_NOT_CONFIGURED");
    return nodemailer.createTransport(resolveSmtpTransportSettings(this.env, settings, password));
  }

  async verify(): Promise<void> {
    const settings = await this.settings();
    await (await this.transporter(settings)).verify();
  }

  async send(to: string, subject: string, html: string, options: EmailSendOptions = {}): Promise<EmailResult> {
    const settings = await this.settings();
    const transport = await this.transporter(settings);
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

  async test(to: string, candidateSettings?: SmtpSettings): Promise<EmailResult> {
    const settings = candidateSettings ?? await this.settings();
    const transport = await this.transporter(settings, true);
    await transport.verify();
    const info = await transport.sendMail({
      from: {name: settings.EMAIL_FROM_NAME ?? this.env.EMAIL_FROM_NAME, address: settings.EMAIL_FROM ?? this.env.EMAIL_FROM},
      replyTo: settings.EMAIL_REPLY_TO ?? this.env.EMAIL_REPLY_TO,
      to,
      subject: "בדיקת SMTP של SynCash",
      html: "<p dir=\"rtl\">הגדרת הדוא״ל נבדקה בהצלחה.</p>",
      text: "הגדרת הדוא״ל נבדקה בהצלחה."
    });
    return {messageId: sanitizeMessageId(info.messageId)};
  }
}

export function sanitizeMessageId(messageId: string): string {
  return messageId.replace(/[^\x21-\x7e]/g, "").slice(0, 255);
}

export function sanitizeSmtpFailure(error: unknown): SanitizedSmtpFailure {
  if (error instanceof SmtpServiceError && ["EMAIL_DELIVERY_DISABLED", "EMAIL_CONFIGURATION_NOT_ACTIVE"].includes(error.code)) {
    return {code: "EMAIL_DELIVERY_DISABLED", message: "שירות שליחת הדוא״ל אינו פעיל כעת.", status: 503};
  }
  if (error instanceof SmtpServiceError && error.code === "SMTP_PASSWORD_NOT_CONFIGURED") {
    return {code: "SMTP_CREDENTIAL_NOT_CONFIGURED", message: "לא הוגדרה סיסמת SMTP.", status: 409};
  }
  const details = typeof error === "object" && error !== null ? error as {code?: unknown; responseCode?: unknown; command?: unknown} : {};
  const code = String(details.code ?? "");
  const responseCode = Number(details.responseCode ?? 0);
  if (code === "EAUTH" || responseCode === 535) {
    return {code: "SMTP_AUTH_FAILED", message: "שם המשתמש או סיסמת ה-SMTP שגויים.", status: 502};
  }
  if (["ECONNECTION", "ECONNREFUSED", "ETIMEDOUT", "EDNS", "EHOSTUNREACH", "ENOTFOUND"].includes(code)) {
    return {code: "SMTP_CONNECTION_FAILED", message: "החיבור לשרת הדוא״ל נכשל.", status: 502};
  }
  if (code === "ETLS" || String(details.command ?? "").toUpperCase() === "STARTTLS") {
    return {code: "SMTP_TLS_FAILED", message: "החיבור המאובטח לשרת הדוא״ל נכשל.", status: 502};
  }
  if (responseCode >= 550 && responseCode < 560) {
    return {code: "SMTP_SENDER_REJECTED", message: "כתובת השולח נדחתה על ידי ספק הדוא״ל.", status: 502};
  }
  return {code: "SMTP_TEST_FAILED", message: "בדיקת ה-SMTP נכשלה.", status: 502};
}

export function sanitizeEmailError(): string {
  return "Email delivery failed";
}

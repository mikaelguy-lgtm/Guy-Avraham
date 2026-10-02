import { describe, expect, it } from "vitest";
import { EmailService, resolveSmtpTransportSettings } from "../../src/services/email";
import { validateSmtpEndpoint } from "../../src/services/smtpSecurity";
import { InMemorySecretProvider } from "../../src/utils/secretManager";
import { env } from "../helpers/fakes";

describe("dynamic SMTP configuration", () => {
  it("preserves immutable secret versions for rollback", async () => {
    const secrets = new InMemorySecretProvider();
    const firstVersion = await secrets.setSecret("syncash-smtp-password", "first-value");
    const secondVersion = await secrets.setSecret("syncash-smtp-password", "second-value");
    expect(await secrets.getSecret("syncash-smtp-password", firstVersion)).toBe("first-value");
    expect(await secrets.getSecret("syncash-smtp-password", secondVersion)).toBe("second-value");
    expect(await secrets.getSecret("syncash-smtp-password")).toBe("second-value");
  });

  it("observes activation changes without recreating the service", async () => {
    let status = "DRAFT";
    const email = new EmailService({...env, EMAIL_DELIVERY_ENABLED: false}, new InMemorySecretProvider(), async () => ({SMTP_CONFIGURATION_STATUS: status}));
    expect(await email.isDeliveryActive()).toBe(false);
    status = "ACTIVE";
    expect(await email.isDeliveryActive()).toBe(true);
  });

  it("maps all three connection security modes explicitly", () => {
    expect(resolveSmtpTransportSettings(env, {SMTP_PORT: "25", SMTP_SECURITY_MODE: "NONE"}, null)).toEqual(expect.objectContaining({secure: false, requireTLS: false, ignoreTLS: true}));
    expect(resolveSmtpTransportSettings(env, {SMTP_PORT: "587", SMTP_SECURITY_MODE: "STARTTLS"}, null)).toEqual(expect.objectContaining({secure: false, requireTLS: true, ignoreTLS: false}));
    expect(resolveSmtpTransportSettings(env, {SMTP_PORT: "465", SMTP_SECURITY_MODE: "TLS"}, null)).toEqual(expect.objectContaining({secure: true, requireTLS: false, ignoreTLS: false}));
  });

  it("blocks SSRF targets and non-standard production ports", async () => {
    await expect(validateSmtpEndpoint({provider: "CUSTOM", host: "127.0.0.1", port: 587, securityMode: "STARTTLS", nodeEnv: "production"})).rejects.toThrow("SMTP_HOST_NOT_ALLOWED");
    await expect(validateSmtpEndpoint({provider: "CUSTOM", host: "8.8.8.8", port: 8080, securityMode: "STARTTLS", nodeEnv: "production"})).rejects.toThrow("SMTP_PORT_NOT_ALLOWED");
    await expect(validateSmtpEndpoint({provider: "CUSTOM", host: "8.8.8.8", port: 587, securityMode: "STARTTLS", nodeEnv: "production"})).resolves.toBeUndefined();
  });

  it("enforces Gmail and Brevo presets", async () => {
    await expect(validateSmtpEndpoint({provider: "GMAIL", host: "smtp.gmail.com", port: 587, securityMode: "STARTTLS", nodeEnv: "test"})).resolves.toBeUndefined();
    await expect(validateSmtpEndpoint({provider: "BREVO", host: "smtp-relay.brevo.com", port: 587, securityMode: "STARTTLS", nodeEnv: "test"})).resolves.toBeUndefined();
    await expect(validateSmtpEndpoint({provider: "GMAIL", host: "smtp.gmail.com", port: 465, securityMode: "TLS", nodeEnv: "test"})).rejects.toThrow("SMTP_PROVIDER_PRESET_INVALID");
  });
});

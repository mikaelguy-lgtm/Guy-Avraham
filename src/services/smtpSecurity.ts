import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { EmailProvider } from "./store.js";

const productionPorts = new Set([25, 465, 587, 2525]);
const blockedHostnames = new Set(["localhost", "metadata.google.internal", "metadata.google.com"]);

function blockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224;
}

function blockedIp(address: string): boolean {
  const type = isIP(address);
  if (type === 4) return blockedIpv4(address);
  if (type !== 6) return true;
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

export async function validateSmtpEndpoint(values: {
  provider: EmailProvider;
  host: string;
  port: number;
  securityMode?: "NONE" | "STARTTLS" | "TLS";
  nodeEnv: "development" | "test" | "production";
}): Promise<void> {
  const host = values.host.trim().toLowerCase().replace(/\.$/, "");
  if (values.provider === "GMAIL" && (host !== "smtp.gmail.com" || values.port !== 587)) throw new Error("SMTP_PROVIDER_PRESET_INVALID");
  if (values.provider === "BREVO" && (host !== "smtp-relay.brevo.com" || values.port !== 587)) throw new Error("SMTP_PROVIDER_PRESET_INVALID");
  if ((values.provider === "GMAIL" || values.provider === "BREVO") && values.securityMode && values.securityMode !== "STARTTLS") throw new Error("SMTP_PROVIDER_PRESET_INVALID");
  if (values.nodeEnv !== "production") return;
  if (!productionPorts.has(values.port)) throw new Error("SMTP_PORT_NOT_ALLOWED");
  if (!host || blockedHostnames.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("SMTP_HOST_NOT_ALLOWED");
  }
  if (isIP(host)) {
    if (blockedIp(host)) throw new Error("SMTP_HOST_NOT_ALLOWED");
    return;
  }
  const addresses = await lookup(host, {all: true, verbatim: true});
  if (addresses.length === 0 || addresses.some(({address}) => blockedIp(address))) throw new Error("SMTP_HOST_NOT_ALLOWED");
}

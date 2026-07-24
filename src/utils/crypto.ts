import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

export class EncryptionService {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error("Encryption key must be exactly 32 bytes");
    }
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
  }

  decrypt(payload: string): string {
    const [version, ivValue, tagValue, ciphertextValue, extra] = payload.split(":");
    if (version !== VERSION || !ivValue || !tagValue || ciphertextValue === undefined || extra !== undefined) {
      throw new Error("Invalid encrypted payload");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64")),
      decipher.final()
    ]).toString("utf8");
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenHashesEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

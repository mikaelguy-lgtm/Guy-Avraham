import {createHash, createHmac, randomBytes, timingSafeEqual} from "node:crypto";

export class DeliveryTokenService {
  constructor(private readonly key: Buffer) {
    if (key.length < 32) throw new Error("Delivery token key must contain at least 32 bytes");
  }

  createNonce(): string {
    return randomBytes(24).toString("base64url");
  }

  deriveToken(purpose: string, publicId: string, nonce: string): string {
    return createHmac("sha256", this.key).update(`${purpose}:${publicId}:${nonce}`).digest("base64url");
  }

  hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  verifyHash(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  deriveOtp(purpose: string, publicId: string, nonce: string): string {
    const digest = createHmac("sha256", this.key).update(`otp:${purpose}:${publicId}:${nonce}`).digest();
    return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
  }

  signPreview(payload: string): string {
    const signature = createHmac("sha256", this.key).update(`preview:${payload}`).digest("base64url");
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
  }

  verifyPreview(value: string): string | null {
    const [encoded, signature, extra] = value.split(".");
    if (!encoded || !signature || extra) return null;
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = createHmac("sha256", this.key).update(`preview:${payload}`).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right) ? payload : null;
  }
}

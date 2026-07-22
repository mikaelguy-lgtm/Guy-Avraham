import { describe, expect, it } from "vitest";
import { EncryptionService } from "../../src/utils/crypto";

describe("EncryptionService", () => {
  it("round-trips AES-256-GCM values", () => {
    const service = new EncryptionService(Buffer.alloc(32, 7));
    expect(service.decrypt(service.encrypt("sensitive value"))).toBe("sensitive value");
  });

  it("rejects tampered ciphertext", () => {
    const service = new EncryptionService(Buffer.alloc(32, 7));
    const encrypted = service.encrypt("sensitive value");
    const tampered = `${encrypted.slice(0, -2)}AA`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it("rejects a wrong key", () => {
    const encrypted = new EncryptionService(Buffer.alloc(32, 1)).encrypt("value");
    expect(() => new EncryptionService(Buffer.alloc(32, 2)).decrypt(encrypted)).toThrow();
  });

  it("uses a random IV for every encryption", () => {
    const service = new EncryptionService(Buffer.alloc(32, 3));
    expect(service.encrypt("same")).not.toBe(service.encrypt("same"));
  });

  it("requires a 32-byte key", () => {
    expect(() => new EncryptionService(Buffer.alloc(31))).toThrow(/32 bytes/);
  });
});


import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleSecretManagerProvider, LocalEncryptedSecretProvider } from "../../src/utils/secretManager";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true}))); });

describe("LocalEncryptedSecretProvider", () => {
  it("persists runtime secrets encrypted at rest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "syncash-secrets-"));
    directories.push(directory);
    const filePath = join(directory, "secrets.bin");
    const masterKey = randomBytes(32).toString("base64");
    const provider = new LocalEncryptedSecretProvider(filePath, masterKey, {});
    const firstVersion = await provider.setSecret("syncash-smtp-password", "local-secret-value");
    const secondVersion = await provider.setSecret("syncash-smtp-password", "new-local-secret-value");
    expect(await provider.getSecret("syncash-smtp-password")).toBe("new-local-secret-value");
    expect(await provider.getSecret("syncash-smtp-password", firstVersion)).toBe("local-secret-value");
    expect(await provider.getSecret("syncash-smtp-password", secondVersion)).toBe("new-local-secret-value");
    expect((await readFile(filePath)).includes(Buffer.from("local-secret-value"))).toBe(false);
    expect(await new LocalEncryptedSecretProvider(filePath, masterKey, {}).getSecret("syncash-smtp-password", firstVersion)).toBe("local-secret-value");
  });

  it("falls back to environment values for read-only startup secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "syncash-secrets-"));
    directories.push(directory);
    const provider = new LocalEncryptedSecretProvider(join(directory, "secrets.bin"), randomBytes(32).toString("base64"), {FIELD_ENCRYPTION_KEY: "environment-key"});
    expect(await provider.getSecret("syncash-field-encryption-key")).toBe("environment-key");
  });
});

describe("GoogleSecretManagerProvider", () => {
  it("canonicalizes numeric Google project references before storing or reading them", async () => {
    const addSecretVersion = vi.fn().mockResolvedValue([{name: "projects/814743030438/secrets/syncash-smtp-password/versions/42"}]);
    const accessSecretVersion = vi.fn().mockResolvedValue([{payload: {data: Buffer.from("configured")}}]);
    const provider = new GoogleSecretManagerProvider("syncash-production", {addSecretVersion, accessSecretVersion} as never);

    await expect(provider.setSecret("syncash-smtp-password", "private-value")).resolves.toBe("projects/syncash-production/secrets/syncash-smtp-password/versions/42");
    await expect(provider.getSecret("syncash-smtp-password", "projects/814743030438/secrets/syncash-smtp-password/versions/42")).resolves.toBe("configured");
    expect(accessSecretVersion).toHaveBeenCalledWith({name: "projects/syncash-production/secrets/syncash-smtp-password/versions/42"});
  });

  it("rejects a version reference for a different secret", async () => {
    const provider = new GoogleSecretManagerProvider("syncash-production", {accessSecretVersion: vi.fn()} as never);
    await expect(provider.getSecret("syncash-smtp-password", "projects/123/secrets/another-secret/versions/1")).rejects.toThrow("INVALID_SECRET_VERSION");
  });
});

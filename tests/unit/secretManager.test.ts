import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalEncryptedSecretProvider } from "../../src/utils/secretManager";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true}))); });

describe("LocalEncryptedSecretProvider", () => {
  it("persists runtime secrets encrypted at rest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "syncash-secrets-"));
    directories.push(directory);
    const filePath = join(directory, "secrets.bin");
    const masterKey = randomBytes(32).toString("base64");
    const provider = new LocalEncryptedSecretProvider(filePath, masterKey, {});
    await provider.setSecret("syncash-smtp-password", "local-secret-value");
    expect(await provider.getSecret("syncash-smtp-password")).toBe("local-secret-value");
    expect((await readFile(filePath)).includes(Buffer.from("local-secret-value"))).toBe(false);
    expect(await new LocalEncryptedSecretProvider(filePath, masterKey, {}).getSecret("syncash-smtp-password")).toBe("local-secret-value");
  });

  it("falls back to environment values for read-only startup secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "syncash-secrets-"));
    directories.push(directory);
    const provider = new LocalEncryptedSecretProvider(join(directory, "secrets.bin"), randomBytes(32).toString("base64"), {FIELD_ENCRYPTION_KEY: "environment-key"});
    expect(await provider.getSecret("syncash-field-encryption-key")).toBe("environment-key");
  });
});

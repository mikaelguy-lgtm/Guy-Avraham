import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface SecretProvider {
  getSecret(name: string): Promise<string | null>;
  setSecret?(name: string, value: string): Promise<void>;
  isConfigured(name: string): Promise<boolean>;
}

const ENV_MAP: Record<string, string> = {
  "syncash-database-url": "DATABASE_URL",
  "syncash-field-encryption-key": "FIELD_ENCRYPTION_KEY",
  "syncash-smtp-password": "SMTP_PASSWORD",
  "syncash-gemini-api-key": "GEMINI_API_KEY",
  "syncash-s3-secret-key": "S3_SECRET_KEY",
  "syncash-firebase-private-key": "FIREBASE_PRIVATE_KEY"
};

function environmentName(name: string): string {
  return ENV_MAP[name] ?? name.toUpperCase().replaceAll("-", "_");
}

export class EnvironmentSecretProvider implements SecretProvider {
  constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  async getSecret(name: string): Promise<string | null> {
    return this.source[environmentName(name)] ?? null;
  }

  async isConfigured(name: string): Promise<boolean> {
    return Boolean(await this.getSecret(name));
  }
}

const LOCAL_STORE_MAGIC = Buffer.from("SYNCASH1", "ascii");

export class LocalEncryptedSecretProvider implements SecretProvider {
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly key: Buffer;

  constructor(
    private readonly filePath: string,
    masterKey: string,
    private readonly source: NodeJS.ProcessEnv = process.env
  ) {
    this.key = Buffer.from(masterKey, "base64");
    if (!filePath) throw new Error("LOCAL_SECRET_STORE_PATH is required");
    if (this.key.length !== 32) throw new Error("LOCAL_SECRET_MASTER_KEY must decode to exactly 32 bytes");
  }

  private async readValues(): Promise<Record<string, string>> {
    let encrypted: Buffer;
    try {
      encrypted = await readFile(this.filePath);
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return {};
      throw new Error("LOCAL_SECRET_STORE_READ_FAILED");
    }
    try {
      if (!encrypted.subarray(0, LOCAL_STORE_MAGIC.length).equals(LOCAL_STORE_MAGIC)) throw new Error("invalid magic");
      const ivStart = LOCAL_STORE_MAGIC.length;
      const tagStart = ivStart + 12;
      const dataStart = tagStart + 16;
      const decipher = createDecipheriv("aes-256-gcm", this.key, encrypted.subarray(ivStart, tagStart));
      decipher.setAuthTag(encrypted.subarray(tagStart, dataStart));
      const payload = Buffer.concat([decipher.update(encrypted.subarray(dataStart)), decipher.final()]).toString("utf8");
      const parsed: unknown = JSON.parse(payload);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid payload");
      const values: Record<string, string> = {};
      for (const [name, value] of Object.entries(parsed)) {
        if (typeof value !== "string") throw new Error("invalid value");
        values[name] = value;
      }
      return values;
    } catch {
      throw new Error("LOCAL_SECRET_STORE_DECRYPT_FAILED");
    }
  }

  private async writeValues(values: Record<string, string>): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(values), "utf8"), cipher.final()]);
    const output = Buffer.concat([LOCAL_STORE_MAGIC, iv, cipher.getAuthTag(), encrypted]);
    await mkdir(dirname(this.filePath), {recursive: true, mode: 0o700});
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, output, {mode: 0o600});
    await rename(temporaryPath, this.filePath);
  }

  async getSecret(name: string): Promise<string | null> {
    const values = await this.readValues();
    return values[name] ?? this.source[environmentName(name)] ?? null;
  }

  async setSecret(name: string, value: string): Promise<void> {
    if (!/^[a-z0-9-]{1,120}$/.test(name)) throw new Error("INVALID_SECRET_NAME");
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const values = await this.readValues();
      values[name] = value;
      await this.writeValues(values);
    });
    await this.writeQueue;
  }

  async isConfigured(name: string): Promise<boolean> {
    return Boolean(await this.getSecret(name));
  }
}

export class GoogleSecretManagerProvider implements SecretProvider {
  constructor(
    private readonly projectId: string,
    private readonly client = new SecretManagerServiceClient()
  ) {
    if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT is required for Google Secret Manager");
  }

  async getSecret(name: string): Promise<string | null> {
    const [version] = await this.client.accessSecretVersion({
      name: `projects/${this.projectId}/secrets/${name}/versions/latest`
    });
    return version.payload?.data?.toString() ?? null;
  }

  async setSecret(name: string, value: string): Promise<void> {
    const parent = `projects/${this.projectId}`;
    try {
      await this.client.getSecret({name: `${parent}/secrets/${name}`});
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : 0;
      if (code !== 5) throw error;
      await this.client.createSecret({
        parent,
        secretId: name,
        secret: {replication: {automatic: {}}}
      });
    }
    await this.client.addSecretVersion({
      parent: `${parent}/secrets/${name}`,
      payload: {data: Buffer.from(value, "utf8")}
    });
  }

  async isConfigured(name: string): Promise<boolean> {
    return Boolean(await this.getSecret(name));
  }
}

export class InMemorySecretProvider implements SecretProvider {
  private readonly values = new Map<string, string>();

  constructor(initialValues: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialValues)) this.values.set(key, value);
  }

  async getSecret(name: string): Promise<string | null> {
    return this.values.get(name) ?? null;
  }

  async setSecret(name: string, value: string): Promise<void> {
    this.values.set(name, value);
  }

  async isConfigured(name: string): Promise<boolean> {
    return this.values.has(name);
  }
}

export function createSecretProvider(provider: "environment" | "google" | "local-encrypted", options: {
  projectId?: string;
  nodeEnv?: "development" | "test" | "production";
  localPath?: string;
  localMasterKey?: string;
} = {}): SecretProvider {
  if (provider === "google") return new GoogleSecretManagerProvider(options.projectId ?? "");
  if (provider === "local-encrypted") {
    if (options.nodeEnv === "production") throw new Error("Local encrypted secrets are forbidden in production");
    return new LocalEncryptedSecretProvider(options.localPath ?? "", options.localMasterKey ?? "");
  }
  return new EnvironmentSecretProvider();
}

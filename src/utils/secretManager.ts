import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// Interface defining the secret provider contract
export interface SecretProvider {
  getSecret(name: string): Promise<string | null>;
  setSecret(name: string, value: string): Promise<void>;
  isConfigured(name: string): Promise<boolean>;
}

// Map Secret Manager names to local Environment variables
const ENV_MAP: Record<string, string> = {
  "syncash-database-url": "DATABASE_URL",
  "syncash-field-encryption-key": "FIELD_ENCRYPTION_KEY",
  "syncash-smtp-password": "SMTP_PASSWORD",
  "syncash-gemini-api-key": "GEMINI_API_KEY",
  "syncash-s3-secret-key": "S3_SECRET_KEY",
  "syncash-firebase-private-key": "FIREBASE_PRIVATE_KEY",
};

// 1. Google Secret Manager Provider (Official SDK)
export class GoogleSecretManagerProvider implements SecretProvider {
  private client: SecretManagerServiceClient;
  private projectId: string;

  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "syncash-project";
  }

  async getSecret(name: string): Promise<string | null> {
    try {
      const [version] = await this.client.accessSecretVersion({
        name: `projects/${this.projectId}/secrets/${name}/versions/latest`,
      });
      return version.payload?.data?.toString() || null;
    } catch (e) {
      console.warn(`[GoogleSecretManagerProvider] Failed to fetch secret '${name}', trying environment fallback:`, e);
      // Fallback to process.env mapping
      const envKey = ENV_MAP[name] || name.toUpperCase().replace(/-/g, "_");
      return process.env[envKey] || process.env[name] || null;
    }
  }

  async setSecret(name: string, value: string): Promise<void> {
    const parent = `projects/${this.projectId}`;
    try {
      // 1. Ensure secret exists
      try {
        await this.client.getSecret({ name: `${parent}/secrets/${name}` });
      } catch (err: any) {
        if (err.code === 5 || err.status === "NOT_FOUND" || String(err).includes("NOT_FOUND")) {
          await this.client.createSecret({
            parent,
            secretId: name,
            secret: {
              replication: {
                automatic: {},
              },
            },
          });
        } else {
          throw err;
        }
      }

      // 2. Add secret version
      await this.client.addSecretVersion({
        parent: `${parent}/secrets/${name}`,
        payload: {
          data: Buffer.from(value, "utf8"),
        },
      });
      
      // Also update process.env for runtime continuity
      const envKey = ENV_MAP[name] || name.toUpperCase().replace(/-/g, "_");
      process.env[envKey] = value;
      
      console.log(`[GoogleSecretManagerProvider] Successfully saved new secret version for '${name}'`);
    } catch (e: any) {
      console.error(`[GoogleSecretManagerProvider] Failed to set secret '${name}':`, e);
      throw new Error(`שגיאה בשמירת סוד ב-Google Secret Manager: ${e.message || String(e)}`);
    }
  }

  async isConfigured(name: string): Promise<boolean> {
    const val = await this.getSecret(name);
    return !!val;
  }
}

// 2. Environment Secret Provider (Read-Only)
export class EnvironmentSecretProvider implements SecretProvider {
  async getSecret(name: string): Promise<string | null> {
    const envKey = ENV_MAP[name] || name.toUpperCase().replace(/-/g, "_");
    return process.env[envKey] || process.env[name] || null;
  }

  async setSecret(name: string, value: string): Promise<void> {
    throw new Error("שינוי הגדרות סודיות חסום במצב Environment Provider. יש להגדיר משתני סביבה בשרת.");
  }

  async isConfigured(name: string): Promise<boolean> {
    const val = await this.getSecret(name);
    return !!val;
  }
}

// 3. In-Memory Secret Provider (For Isolated Testing)
export class InMemorySecretProvider implements SecretProvider {
  private secrets = new Map<string, string>();

  async getSecret(name: string): Promise<string | null> {
    return this.secrets.get(name) || null;
  }

  async setSecret(name: string, value: string): Promise<void> {
    this.secrets.set(name, value);
  }

  async isConfigured(name: string): Promise<boolean> {
    return this.secrets.has(name);
  }
}

// Active provider initialization
let activeProvider: SecretProvider;

if (process.env.NODE_ENV === "test") {
  activeProvider = new InMemorySecretProvider();
} else if (process.env.USE_GOOGLE_SECRET_MANAGER === "true" || process.env.GOOGLE_CLOUD_PROJECT) {
  activeProvider = new GoogleSecretManagerProvider();
} else {
  activeProvider = new EnvironmentSecretProvider();
}

export function getSecretProvider(): SecretProvider {
  return activeProvider;
}

export function setSecretProvider(provider: SecretProvider): void {
  activeProvider = provider;
}

// Wrapper functions for backward compatibility with existing codebase
export async function getSecret(secretName: string): Promise<string> {
  const value = await activeProvider.getSecret(secretName);
  return value || "";
}

export async function setSecret(secretName: string, value: string): Promise<void> {
  await activeProvider.setSecret(secretName, value);
}

export async function isSecretConfigured(secretName: string): Promise<boolean> {
  return activeProvider.isConfigured(secretName);
}

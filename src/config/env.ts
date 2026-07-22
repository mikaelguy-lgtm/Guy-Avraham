import "dotenv/config";
import { z } from "zod";

const optionalText = z.string().trim().optional().default("");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:3000"),
  ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  FIREBASE_PROJECT_ID: optionalText,
  FIREBASE_CLIENT_EMAIL: optionalText,
  FIREBASE_PRIVATE_KEY: optionalText,
  FIREBASE_AUTH_EMULATOR_HOST: optionalText,
  SECRET_PROVIDER: z.enum(["environment", "google", "local-encrypted"]).default("environment"),
  GOOGLE_CLOUD_PROJECT: optionalText,
  LOCAL_SECRET_STORE_PATH: optionalText,
  LOCAL_SECRET_MASTER_KEY: optionalText,
  FIELD_ENCRYPTION_KEY: optionalText,
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.string().default("true").transform((value) => value === "true"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.string().default("false").transform((value) => value === "true"),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().min(1),
  EMAIL_REPLY_TO: z.string().email(),
  GEMINI_API_KEY: optionalText,
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(50).default(15),
  LENDER_INVITE_EXPIRY_HOURS: z.coerce.number().int().min(1).max(168).default(72),
  PASSWORD_RESET_EXPIRY_MINUTES: z.coerce.number().int().min(5).max(1440).default(30)
});

export type AppEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  const env = parsed.data;
  if (env.FIELD_ENCRYPTION_KEY) {
    const key = Buffer.from(env.FIELD_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) {
      throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes");
    }
  }

  if (env.NODE_ENV === "production") {
    const required = [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "FIELD_ENCRYPTION_KEY"
    ] as const;
    const missing = required.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
    }
    if (env.ALLOWED_ORIGINS.split(",").some((origin) => origin.trim() === "*")) {
      throw new Error("Wildcard CORS origins are forbidden in production");
    }
    if (env.SECRET_PROVIDER === "local-encrypted") {
      throw new Error("Local encrypted secrets are forbidden in production");
    }
  }
  if (env.SECRET_PROVIDER === "local-encrypted") {
    if (!env.LOCAL_SECRET_STORE_PATH) throw new Error("LOCAL_SECRET_STORE_PATH is required for local encrypted secrets");
    if (Buffer.from(env.LOCAL_SECRET_MASTER_KEY, "base64").length !== 32) {
      throw new Error("LOCAL_SECRET_MASTER_KEY must decode to exactly 32 bytes");
    }
  }

  return env;
}

export function allowedOrigins(env: AppEnv): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
}

import { getAuth } from "firebase-admin/auth";
import { loadEnv } from "../config/env.js";
import { FirebaseTokenVerifier, type TokenVerifier } from "../middleware/auth.js";
import { DeliveryEventBroker } from "../services/deliveryEvents.js";
import { DeliveryTokenService } from "../services/deliveryTokens.js";
import { EmailService } from "../services/email.js";
import { AdvisorEmailVerificationService, EmulatorFirebaseVerificationLinkProvider, ProductionFirebaseVerificationLinkProvider } from "../services/emailVerification.js";
import { GeminiService } from "../services/gemini.js";
import { PostgresLenderDeliveryService } from "../services/lenderDelivery.js";
import { AdvisorPasswordResetService, EmulatorFirebasePasswordResetLinkProvider, ProductionFirebasePasswordResetLinkProvider } from "../services/passwordReset.js";
import { RedisRateLimitStore } from "../services/rateLimiter.js";
import { S3StorageService } from "../services/storage.js";
import { PostgresStore } from "../services/store.js";
import { EncryptionService } from "../utils/crypto.js";
import { createSecretProvider } from "../utils/secretManager.js";

export async function createServerRuntime() {
  const configuredEnv = loadEnv();
  const secrets = createSecretProvider(configuredEnv.SECRET_PROVIDER, {
    projectId: configuredEnv.GOOGLE_CLOUD_PROJECT,
    nodeEnv: configuredEnv.NODE_ENV,
    localPath: configuredEnv.LOCAL_SECRET_STORE_PATH,
    localMasterKey: configuredEnv.LOCAL_SECRET_MASTER_KEY
  });
  const encryptionKey = await secrets.getSecret("syncash-field-encryption-key");
  if (!encryptionKey) throw new Error("FIELD_ENCRYPTION_KEY is required to start the API");
  const firebasePrivateKey = configuredEnv.FIREBASE_PRIVATE_KEY || await secrets.getSecret("syncash-firebase-private-key") || "";
  const env = {...configuredEnv, FIREBASE_PRIVATE_KEY: firebasePrivateKey};

  const store = new PostgresStore();
  const storage = new S3StorageService(env);
  await storage.initialize();
  const email = new EmailService(env, secrets, async () => {
    const active = await store.getActiveEmailConfiguration();
    if (active) return {
      SMTP_CONFIGURATION_STATUS: active.status,
      SMTP_HOST: active.host,
      SMTP_PORT: String(active.port),
      SMTP_SECURITY_MODE: active.securityMode,
      SMTP_USER: active.username,
      EMAIL_FROM: active.fromEmail,
      EMAIL_FROM_NAME: active.fromName,
      EMAIL_REPLY_TO: active.replyTo,
      SMTP_SECRET_NAME: active.secretName,
      SMTP_SECRET_VERSION: active.secretVersion
    };
    return Object.fromEntries((await store.getSettings("SMTP")).map((setting) => [setting.key, setting.value]));
  });
  const encryption = new EncryptionService(Buffer.from(encryptionKey, "base64"));
  const deliveryEvents = new DeliveryEventBroker();
  const delivery = new PostgresLenderDeliveryService({
    storage,
    email,
    encryption,
    tokens: new DeliveryTokenService(Buffer.from(encryptionKey, "base64")),
    broker: deliveryEvents,
    appUrl: env.APP_URL,
    nodeEnv: env.NODE_ENV,
    processJobsOnDemand: env.NODE_ENV !== "production"
  });

  return {env, secrets, store, storage, email, encryption, deliveryEvents, delivery};
}

export async function createApiRuntime() {
  const runtime = await createServerRuntime();
  const {env, store, email} = runtime;
  const verifier: TokenVerifier = env.FIREBASE_PROJECT_ID && (env.FIREBASE_AUTH_EMULATOR_HOST || (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY))
    ? new FirebaseTokenVerifier(env)
    : {verify: async () => { throw new Error("Firebase Admin is not configured"); }};
  const firebaseAuth = getAuth();
  const verificationLinks = env.FIREBASE_AUTH_EMULATOR_HOST
    ? new EmulatorFirebaseVerificationLinkProvider(firebaseAuth, env.APP_URL)
    : new ProductionFirebaseVerificationLinkProvider(firebaseAuth, env.APP_URL);
  const passwordResetLinks = env.FIREBASE_AUTH_EMULATOR_HOST
    ? new EmulatorFirebasePasswordResetLinkProvider(firebaseAuth, env.APP_URL)
    : new ProductionFirebasePasswordResetLinkProvider(firebaseAuth, env.APP_URL);

  return {
    ...runtime,
    verifier,
    firebaseAuth,
    emailVerification: new AdvisorEmailVerificationService(verificationLinks, email, store),
    passwordReset: new AdvisorPasswordResetService(passwordResetLinks, email, store),
    limiter: new RedisRateLimitStore(env.REDIS_URL),
    gemini: new GeminiService(env.GEMINI_API_KEY, env.GEMINI_MODEL)
  };
}

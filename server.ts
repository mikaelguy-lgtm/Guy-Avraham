import { loadEnv } from "./src/config/env.js";
import { createApp } from "./src/server/app.js";
import { EmailService } from "./src/services/email.js";
import { AdvisorEmailVerificationService, EmulatorFirebaseVerificationLinkProvider, ProductionFirebaseVerificationLinkProvider } from "./src/services/emailVerification.js";
import { GeminiService } from "./src/services/gemini.js";
import { RedisRateLimitStore } from "./src/services/rateLimiter.js";
import { PostgresStore } from "./src/services/store.js";
import { S3StorageService } from "./src/services/storage.js";
import { FirebaseTokenVerifier, type TokenVerifier } from "./src/middleware/auth.js";
import { EncryptionService } from "./src/utils/crypto.js";
import { createSecretProvider } from "./src/utils/secretManager.js";
import { getAuth } from "firebase-admin/auth";

const env = loadEnv();
const secrets = createSecretProvider(env.SECRET_PROVIDER, {
  projectId: env.GOOGLE_CLOUD_PROJECT,
  nodeEnv: env.NODE_ENV,
  localPath: env.LOCAL_SECRET_STORE_PATH,
  localMasterKey: env.LOCAL_SECRET_MASTER_KEY
});
const encryptionKey = await secrets.getSecret("syncash-field-encryption-key");
if (!encryptionKey) {
  throw new Error("FIELD_ENCRYPTION_KEY is required to start the API");
}

const verifier: TokenVerifier = env.FIREBASE_PROJECT_ID && (env.FIREBASE_AUTH_EMULATOR_HOST || (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY))
  ? new FirebaseTokenVerifier(env)
  : {verify: async () => { throw new Error("Firebase Admin is not configured"); }};
const storage = new S3StorageService(env);
await storage.initialize();
const store = new PostgresStore();
const email = new EmailService(env, secrets, async () => Object.fromEntries((await store.getSettings("SMTP")).map((setting) => [setting.key, setting.value])));
const firebaseAuth = getAuth();
const verificationLinks = env.FIREBASE_AUTH_EMULATOR_HOST
  ? new EmulatorFirebaseVerificationLinkProvider(firebaseAuth, env.APP_URL)
  : new ProductionFirebaseVerificationLinkProvider(firebaseAuth, env.APP_URL);

const app = createApp({
  env,
  store,
  verifier,
  encryption: new EncryptionService(Buffer.from(encryptionKey, "base64")),
  storage,
  email,
  emailVerification: new AdvisorEmailVerificationService(verificationLinks, email, store),
  secrets,
  limiter: new RedisRateLimitStore(env.REDIS_URL),
  gemini: new GeminiService(env.GEMINI_API_KEY, env.GEMINI_MODEL),
  firebaseAccounts: {
    deleteUser: (uid) => firebaseAuth.deleteUser(uid)
  }
});

const port = new URL(env.API_URL).port || "3000";
app.listen(Number(port), "0.0.0.0", () => {
  console.log(`SynCash API listening on port ${port}`);
});

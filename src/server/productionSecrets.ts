import { loadEnv } from "../config/env.js";
import { createSecretProvider } from "../utils/secretManager.js";

const env = loadEnv();
if (env.NODE_ENV !== "production") throw new Error("Production secret check requires NODE_ENV=production");

const provider = createSecretProvider(env.SECRET_PROVIDER, {
  projectId: env.GOOGLE_CLOUD_PROJECT,
  nodeEnv: env.NODE_ENV,
  localPath: env.LOCAL_SECRET_STORE_PATH,
  localMasterKey: env.LOCAL_SECRET_MASTER_KEY
});
const requiredSecrets = [
  "syncash-field-encryption-key",
  "syncash-firebase-private-key",
  "syncash-smtp-password"
];
const missing: string[] = [];
for (const secretName of requiredSecrets) {
  if (!await provider.isConfigured(secretName)) missing.push(secretName);
}
if (missing.length > 0) throw new Error(`Missing production secrets: ${missing.join(", ")}`);
console.log("Production secret provider check passed");

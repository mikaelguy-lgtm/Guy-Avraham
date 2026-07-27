import { closeDatabase } from "./src/db/index.js";
import { createApp } from "./src/server/app.js";
import { createApiRuntime } from "./src/server/runtime.js";

const runtime = await createApiRuntime();
const {env, firebaseAuth} = runtime;
const app = createApp({
  env,
  store: runtime.store,
  verifier: runtime.verifier,
  encryption: runtime.encryption,
  storage: runtime.storage,
  email: runtime.email,
  emailVerification: runtime.emailVerification,
  secrets: runtime.secrets,
  limiter: runtime.limiter,
  gemini: runtime.gemini,
  firebaseAccounts: {deleteUser: (uid) => firebaseAuth.deleteUser(uid)},
  delivery: runtime.delivery,
  deliveryEvents: runtime.deliveryEvents
});

const port = new URL(env.API_URL).port || "3000";
const server = app.listen(Number(port), "0.0.0.0", () => {
  console.log(`SynCash API listening on port ${port}`);
});

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    void closeDatabase().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 15_000).unref();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

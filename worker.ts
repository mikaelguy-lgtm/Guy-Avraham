import { writeFile } from "node:fs/promises";
import { closeDatabase } from "./src/db/index.js";
import { createServerRuntime } from "./src/server/runtime.js";

const heartbeatPath = process.env.WORKER_HEARTBEAT_PATH || "/tmp/syncash-worker-heartbeat";
const intervalMilliseconds = 30_000;
const runtime = await createServerRuntime();
let stopping = false;
let running = false;

async function processDeliveryJobs(): Promise<void> {
  if (stopping || running) return;
  running = true;
  try {
    await runtime.delivery.processJobs({processEmail: await runtime.email.isDeliveryActive()});
    await writeFile(heartbeatPath, new Date().toISOString(), {encoding: "utf8", mode: 0o600});
  } catch {
    console.error("Lender delivery jobs failed", {errorCode: "LENDER_DELIVERY_JOB_FAILED"});
  } finally {
    running = false;
  }
}

await processDeliveryJobs();
const interval = setInterval(() => void processDeliveryJobs(), intervalMilliseconds);

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  while (running) await new Promise((resolve) => setTimeout(resolve, 100));
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());

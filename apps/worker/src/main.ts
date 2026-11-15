import { config } from "dotenv";
import { resolve } from "node:path";
import { Worker } from "bullmq";
config({ path: resolve(__dirname, "../../../.env"), quiet: true });
const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const worker = new Worker(process.env.WORKER_QUEUE ?? "nexora", async (job) => {
  if (job.name === "healthcheck") return { status: "ok", worker: "nexora" };
  throw new Error(`No handler registered for job ${job.name}`);
}, { connection: { host: url.hostname, port: Number(url.port || 6379), username: url.username ? decodeURIComponent(url.username) : undefined, password: url.password ? decodeURIComponent(url.password) : undefined, db: Number(url.pathname.slice(1) || 0), ...(url.protocol === "rediss:" ? { tls: {} } : {}) } });
worker.on("error", error => console.error(error));
async function close() { await worker.close(); }
process.once("SIGTERM", () => { void close(); });
process.once("SIGINT", () => { void close(); });

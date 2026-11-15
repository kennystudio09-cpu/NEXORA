import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../../.env"), quiet: true });
import { Worker } from "bullmq";
import Redis from "ioredis";
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const worker = new Worker("nexora", async (job) => { throw new Error(`No handler registered for job ${job.name}`); }, { connection });
async function close() { await worker.close(); await connection.quit(); }
process.once("SIGTERM", () => { void close(); });
process.once("SIGINT", () => { void close(); });

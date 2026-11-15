import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../../.env"), quiet: true });
import { createApp } from "./app";
async function main() { const app = await createApp(); await app.listen(Number(process.env.API_PORT ?? 4000), "0.0.0.0"); }
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

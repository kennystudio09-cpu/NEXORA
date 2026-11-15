import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
// Isolated builds and ports prevent development servers from satisfying E2E readiness.
const env = { ...process.env, NEXORA_E2E: "1", API_PORT: "4100", ALLOWED_ORIGINS: "http://localhost:3100,http://localhost:3101,http://localhost:3102" };
const files = ["customer-web", "merchant-web", "admin-web"].map(name => `apps/${name}/next-env.d.ts`);
const originals = await Promise.all(files.map(file => readFile(file)));
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}
try {
  process.exitCode = await run("pnpm", ["build"]);
  if (process.exitCode === 0) process.exitCode = await run(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)]);
} finally {
  // Next regenerates these declarations with its selected distDir. Preserve the normal-build declarations.
  await Promise.all(files.map((file, i) => writeFile(file, originals[i])));
}

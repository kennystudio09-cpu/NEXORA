import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, timeout: 60000,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: { baseURL: "http://localhost:3101", trace: "retain-on-failure", launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] } },
  webServer: [
    { command: "pnpm --filter @nexora/api exec node test/start-e2e.mjs", url: "http://localhost:4100/api/health", reuseExistingServer: false, timeout: 60000 },
    ...[["merchant-web",3101],["customer-web",3100],["admin-web",3102]].map(([name,port]) => ({ command: `pnpm --filter @nexora/${name} exec next start -p ${port}`, url: `http://localhost:${port}/login`, reuseExistingServer: false, timeout: 60000 }))
  ]
});

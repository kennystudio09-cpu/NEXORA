import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, timeout: 60000,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: { baseURL: "http://localhost:3001", trace: "retain-on-failure", launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] } },
  webServer: [
    { command: "pnpm --filter @nexora/api start", url: "http://localhost:4000/api/health", reuseExistingServer: false, timeout: 60000 },
    ...[["merchant-web",3001],["customer-web",3000],["admin-web",3002]].map(([name,port]) => ({ command: `pnpm --filter @nexora/${name} exec next start -p ${port}`, url: `http://localhost:${port}/login`, reuseExistingServer: false, timeout: 60000 }))
  ]
});

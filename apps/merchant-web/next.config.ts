import type { NextConfig } from "next";
const e2e = process.env.NEXORA_E2E === "1";
const config: NextConfig = {
  distDir: e2e ? ".next-e2e" : ".next",
  experimental: { cpus: 2 },
  transpilePackages: ["@nexora/ui"],
  async rewrites() { return [{ source: "/api/:path*", destination: `${e2e ? "http://localhost:4100" : (process.env.API_INTERNAL_URL ?? "http://localhost:4000")}/api/:path*` }]; },
};
export default config;

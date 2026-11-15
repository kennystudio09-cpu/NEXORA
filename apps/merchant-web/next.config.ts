import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { cpus: 2 },
  transpilePackages: ["@nexora/ui"],
  async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/api/:path*` }]; },
};
export default config;

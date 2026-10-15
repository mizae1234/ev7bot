/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Browser-side EV7 Core API config (inlined at build time)
  env: {
    EV7_CORE_API_URL: process.env.EV7_CORE_API_URL,
    EV7_CORE_API_TOKEN: process.env.EV7_CORE_API_TOKEN,
  },
  experimental: {
    serverComponentsExternalPackages: ["mssql", "tedious"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

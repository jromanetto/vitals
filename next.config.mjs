/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;

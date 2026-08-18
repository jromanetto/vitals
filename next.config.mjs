/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  // next/image n'est utilisé nulle part dans l'app (icônes = lucide, aucune
  // image raster rendue). Désactiver l'optimisation neutralise le chemin de
  // code sharp/libvips, qui traîne 4 CVE high via la dépendance transitive de
  // Next sans qu'on en tire le moindre bénéfice.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // OAuth discovery lives under /.well-known, which Next won't serve from a
  // dot-prefixed app directory — rewrite to real API routes. The wildcard
  // variants cover resource-scoped requests (…/api/mcp) some MCP clients make.
  async rewrites() {
    return [
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/authorization-server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/authorization-server" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/protected-resource" },
    ];
  },
};
export default nextConfig;

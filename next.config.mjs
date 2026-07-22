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
};
export default nextConfig;

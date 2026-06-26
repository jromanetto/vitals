import type { MetadataRoute } from "next";

// Makes Vitals installable ("Add to Home Screen") — and, on iOS 16.4+, that
// install is what unlocks web push. Icons point to the generated /apple-icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vitals — Health Intelligence",
    short_name: "Vitals",
    description: "Ton dossier santé : biomarqueurs, ADN, longévité — chiffré, hébergé en EU.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    lang: "fr",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/apple-icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

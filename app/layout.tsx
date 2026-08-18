import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/app/providers";

// Self-hosted at build time by next/font (no runtime request, no CSP webfont
// exemption needed). Sora carries the UI + display voice; JetBrains Mono is the
// data voice — biomarker values, units, reference ranges, SNP codes.
const sans = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vitals — Health Intelligence",
  description: "Personal health data, biomarkers, DNA & longevity analytics",
  manifest: "/manifest.webmanifest",
  // Installed-PWA behaviour on iOS (and what unlocks web push there).
  appleWebApp: { capable: true, title: "Vitals", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-3 focus:py-1.5 focus:rounded-md">
          Aller au contenu principal
        </a>
        <ThemeProvider><QueryProvider>{children}</QueryProvider></ThemeProvider>
      </body>
    </html>
  );
}

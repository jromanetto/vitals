import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vitals — Health Intelligence",
  description: "Personal health data, biomarkers, DNA & longevity analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 border-b border-amber-700 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">
            Mode démo · Patient fictif · Crée ton compte pour tes propres données
          </span>
        </div>
        <Link
          href="/signup"
          className="shrink-0 px-3 py-1 rounded-md bg-amber-950 text-amber-50 text-xs font-semibold hover:bg-amber-900 transition"
        >
          Créer mon compte
        </Link>
      </div>
    </div>
  );
}

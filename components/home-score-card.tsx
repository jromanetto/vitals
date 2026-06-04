"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Maximize2 } from "lucide-react";
import { LongevityGauge } from "@/components/longevity-gauge";
import { ScoreBreakdownCard } from "@/components/score-breakdown";
import { ScoreBreakdownModal } from "@/components/score-breakdown-modal";
import type { ScoreBreakdown } from "@/lib/scoring/longevity";

export function HomeScoreCard({ breakdown, empty = false }: { breakdown: ScoreBreakdown; empty?: boolean }) {
  const [open, setOpen] = useState(false);
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="text-4xl">🧬</div>
        <div className="text-base font-medium">Score pas encore calculable</div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Importe un bilan sanguin, ton ADN ou complète ton profil — ton Score longévité s&apos;affiche dès qu&apos;il y a des données à analyser.
        </p>
        <Link href="/import" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-emerald text-white hover:bg-emerald/90 transition">
          Importer mes données →
        </Link>
      </div>
    );
  }
  const blurb =
    breakdown.total >= 80
      ? "Excellent — continue comme ça."
      : breakdown.total >= 60
      ? "Bon — quelques leviers à optimiser."
      : breakdown.total >= 40
      ? "Mitigé — plusieurs axes à travailler."
      : "À surveiller — voir le détail des axes.";
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Voir le détail du score longévité"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="group relative cursor-pointer rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center min-w-[240px] hover:border-emerald/40 hover:shadow-[0_0_0_1px_hsl(var(--emerald)/0.15)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
        >
          <span className="absolute top-3 right-3 h-7 w-7 rounded-full bg-secondary/60 group-hover:bg-emerald/15 text-muted-foreground group-hover:text-emerald flex items-center justify-center transition">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
          <LongevityGauge score={breakdown.total} />
          <div className="mt-4 text-xs text-center text-muted-foreground max-w-[200px] leading-relaxed">
            {blurb}
          </div>
          <div className="mt-3 text-[11px] font-medium text-emerald opacity-0 group-hover:opacity-100 transition">
            Voir le détail →
          </div>
        </motion.button>
        <ScoreBreakdownCard breakdown={breakdown} />
      </div>
      <ScoreBreakdownModal open={open} onClose={() => setOpen(false)} breakdown={breakdown} />
    </>
  );
}

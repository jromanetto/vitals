"use client";
import { motion } from "framer-motion";
import type { ScoreBreakdown } from "@/lib/scoring/longevity";

const ROWS = [
  { key: "biomarkers" as const, label: "Biomarqueurs", max: 40, hint: (b: ScoreBreakdown) => `${b.details.biomarkersInRange}/${b.details.biomarkersTotal} en range` },
  { key: "dna" as const, label: "ADN", max: 25, hint: (b: ScoreBreakdown) => `${b.details.dnaFavorable} favorables · ${b.details.dnaRisk} à surveiller` },
  { key: "lifestyle" as const, label: "Mode de vie", max: 20, hint: (b: ScoreBreakdown) => {
    const ok = b.details.lifestylePoints.filter((p) => p.ok).length;
    return `${ok}/${b.details.lifestylePoints.length} habitudes saines`;
  } },
  { key: "trends" as const, label: "Tendances", max: 15, hint: (b: ScoreBreakdown) => `${b.details.trendsImproving} améliorations · ${b.details.trendsWorsening} régressions` },
];

export function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-medium tracking-tight">Composition du score</h2>
      <p className="text-xs text-muted-foreground mt-1">40% biomarqueurs · 25% ADN · 20% mode de vie · 15% tendances</p>
      <div className="mt-5 space-y-4">
        {ROWS.map((r, i) => {
          const value = breakdown[r.key];
          const pct = (value / r.max) * 100;
          return (
            <motion.div key={r.key}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <div className="flex justify-between text-sm mb-1.5">
                <span>{r.label}</span>
                <span className="text-muted-foreground tabular-nums">{value} / {r.max}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: "easeOut" }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{r.hint(breakdown)}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

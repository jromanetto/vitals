"use client";
import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Dna, Activity, TrendingUp, ArrowRight } from "lucide-react";
import { LongevityGauge } from "@/components/longevity-gauge";
import type { ScoreBreakdown } from "@/lib/scoring/longevity";

type AxisKey = "biomarkers" | "dna" | "lifestyle" | "trends";
type Axis = {
  key: AxisKey;
  label: string;
  max: number;
  icon: React.ReactNode;
  description: (b: ScoreBreakdown) => string;
  hint: (b: ScoreBreakdown) => string;
};

const AXES: Axis[] = [
  {
    key: "biomarkers",
    label: "Biomarqueurs",
    max: 40,
    icon: <Heart className="h-4 w-4" />,
    description: () => "Part de tes biomarqueurs sanguins dans la plage de référence (40% du score).",
    hint: (b) => `${b.details.biomarkersInRange}/${b.details.biomarkersTotal} en range`,
  },
  {
    key: "dna",
    label: "ADN",
    max: 25,
    icon: <Dna className="h-4 w-4" />,
    description: () => "Variants génétiques favorables vs à risque, pondérés par magnitude (25% du score).",
    hint: (b) => `${b.details.dnaFavorable} favorables · ${b.details.dnaRisk} à surveiller`,
  },
  {
    key: "lifestyle",
    label: "Mode de vie",
    max: 20,
    icon: <Activity className="h-4 w-4" />,
    description: () => "Activité, sommeil, tabac, alcool, stress, alimentation, méditation, hydratation (20% du score).",
    hint: (b) => {
      const ok = b.details.lifestylePoints.filter((p) => p.ok).length;
      return `${ok}/${b.details.lifestylePoints.length} habitudes saines`;
    },
  },
  {
    key: "trends",
    label: "Tendances",
    max: 15,
    icon: <TrendingUp className="h-4 w-4" />,
    description: () => "Évolution sur 5 ans des marqueurs clés : LDL, HOMA-IR, CRP, ferritine, TSH, vit D, HbA1c (15% du score).",
    hint: (b) => `${b.details.trendsImproving} en progrès · ${b.details.trendsWorsening} en régression`,
  },
];

function colorFor(pct: number): { bar: string; text: string; chip: string; ring: string } {
  if (pct >= 80) return { bar: "bg-emerald", text: "text-emerald", chip: "bg-emerald/15 text-emerald ring-emerald/30", ring: "ring-emerald/30" };
  if (pct >= 50) return { bar: "bg-amber-400", text: "text-amber-400", chip: "bg-amber-400/15 text-amber-300 ring-amber-400/30", ring: "ring-amber-400/30" };
  return { bar: "bg-red-400", text: "text-red-400", chip: "bg-red-400/15 text-red-300 ring-red-400/30", ring: "ring-red-400/30" };
}

export function ScoreBreakdownModal({
  open,
  onClose,
  breakdown,
}: {
  open: boolean;
  onClose: () => void;
  breakdown: ScoreBreakdown;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Détail du score longévité"
          >
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-6 sm:px-8 pt-8 pb-4 border-b border-border">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Détail du score</div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mt-1">Score longévité</h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                Synthèse 0-100 calculée à partir de tes biomarqueurs, ADN, mode de vie et tendances.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                <div className="scale-110">
                  <LongevityGauge score={breakdown.total} />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-sm font-medium">
                    {breakdown.total >= 80
                      ? "Excellent — continue comme ça."
                      : breakdown.total >= 60
                      ? "Bon — quelques leviers à optimiser."
                      : breakdown.total >= 40
                      ? "Mitigé — plusieurs axes à travailler."
                      : "À surveiller — voir les axes ci-dessous."}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Pondération : 40% biomarqueurs · 25% ADN · 20% mode de vie · 15% tendances.
                  </p>
                  <Link
                    href="/action-plan"
                    onClick={onClose}
                    className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald text-white text-sm font-medium hover:brightness-110 transition"
                  >
                    Voir mon plan d&apos;action
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-5">
              <div className="text-sm font-medium tracking-tight">Décomposition par axe</div>
              {AXES.map((axis, i) => {
                const value = breakdown[axis.key];
                const pct = (value / axis.max) * 100;
                const c = colorFor(pct);
                return (
                  <motion.div
                    key={axis.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                    className="rounded-xl border border-border bg-secondary/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-lg ring-1 flex items-center justify-center shrink-0 ${c.chip} ${c.ring}`}>
                          {axis.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{axis.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{axis.hint(breakdown)}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-semibold tabular-nums px-2 py-1 rounded-md ring-1 ${c.chip} ${c.ring}`}>
                        {value} / {axis.max}
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-border/50 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${c.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, pct)}%` }}
                        transition={{ duration: 0.8, delay: 0.25 + i * 0.06, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                      {axis.description(breakdown)}
                    </p>
                    <Link
                      href="/action-plan"
                      onClick={onClose}
                      className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${c.text} hover:brightness-110 transition`}
                    >
                      Comment améliorer
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, AlertTriangle, Check, ArrowUp, Activity, Apple, Pill, Sparkles } from "lucide-react";

type Coverage = {
  key: string;
  label: string;
  unit: "mg" | "mcg" | "g" | "IU";
  amount: number;
  target: {
    label: string;
    unit: string;
    low: number;
    optimal: [number, number];
    high: number;
    notes?: string;
    primarySource?: "food" | "supplement" | "both";
    dietaryDefault?: number;
    essential?: boolean;
  };
  status: "low" | "optimal" | "above-optimal" | "high" | "complement";
  contributions: { supplementId: number; supplementName: string; rawAmount: number; rawUnit: string; daily: number }[];
};

type BloodHelp = { biomarker: string; status: string; nutrient: string };

type Resp = {
  coverage: Coverage[];
  summary: { low: number; optimal: number; "above-optimal": number; high: number; complement?: number };
  activeCount: number;
};

const STATUS_META = {
  low:           { label: "Sous-dosé",   color: "text-amber-400" },
  optimal:       { label: "Optimal",     color: "text-emerald" },
  "above-optimal": { label: "Au-dessus", color: "text-sky-400" },
  high:          { label: "Excessif",    color: "text-red-400" },
  complement:    { label: "Complément",  color: "text-sky-300" },
};

function format(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

const NUTRIENT_TO_BIOMARKER: Record<string, string[]> = {
  "vitamin-d": ["vitamine-d-25-oh"],
  "b12": ["vitamine-b12", "holotranscobalamine-active-b12"],
  "b9": ["folates-b9", "folates-erythrocytaires"],
  "magnesium": ["magnesium-erythrocytaire", "magnesium-serique"],
  "iron": ["ferritine"],
  "selenium": ["selenium"],
  "zinc": ["zinc-serique"],
  "iodine": ["iode-urinaire"],
  "omega-3": ["index-omega-3"],
  "homocysteine": ["homocysteine"],
};

export function SupplementCoverage({ refreshKey, bloodHelp = [] }: { refreshKey?: number; bloodHelp?: BloodHelp[] }) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch("/api/supplements/coverage").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, [refreshKey]);

  if (!data || data.coverage.length === 0) return null;

  const total = data.coverage.length;
  const sum = data.summary;

  function fillsGap(key: string): BloodHelp | null {
    const linked = NUTRIENT_TO_BIOMARKER[key];
    if (!linked) return null;
    return bloodHelp.find((b) => linked.includes(b.biomarker) && (b.status === "attention" || b.status === "slightly-off" || b.status === "low")) ?? null;
  }

  return (
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald" />
              <h2 className="text-base font-semibold">Bilan nutritionnel</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
            {sum.optimal > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald/15 border border-emerald/30 text-emerald">{sum.optimal} optimal</span>}
            {(sum.complement ?? 0) > 0 && <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300">{sum.complement} complément</span>}
            {sum.low > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">{sum.low} sous-dosé{sum.low > 1 ? "s" : ""}</span>}
            {sum.high > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">{sum.high} excessif</span>}
          </div>
        </div>

        {/* Inline legend */}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-sky-500/70" />
            <Apple className="h-3 w-3" /> Apport alimentaire estimé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-emerald" />
            <Pill className="h-3 w-3" /> Apport supplément (toi)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border-2 border-emerald/60 bg-transparent" />
            Plage optimale
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.coverage.map((c, i) => {
          const meta = STATUS_META[c.status];
          const opt = c.target.optimal;
          const max = c.target.high;
          const dietary = c.target.dietaryDefault ?? 0;
          const fromSup = c.amount;
          const totalIntake = dietary + fromSup;

          // Bar scale: max of (high, totalIntake) for context
          const scale = Math.max(max, totalIntake) * 1.05;
          const dietPct = Math.max(0, Math.min(100, (dietary / scale) * 100));
          const supPct = Math.max(0, Math.min(100, (fromSup / scale) * 100));
          const optMinPct = (opt[0] / scale) * 100;
          const optMaxPct = (opt[1] / scale) * 100;
          const lowPct = (c.target.low / scale) * 100;

          const gap = fillsGap(c.key);
          const isEssential = c.target.essential;
          const inOptimal = totalIntake >= opt[0] && totalIntake <= opt[1];
          const aboveOptimal = totalIntake > opt[1];
          const belowOptimal = totalIntake < opt[0];

          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.4) }}
              className="rounded-md border border-border bg-card/40 p-3 space-y-2.5"
            >
              {/* Top row: name + status badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium">{c.label}</span>
                    {isEssential && (
                      <span className="text-[9px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald/15 border border-emerald/30 text-emerald" title="Recommandé pour tous (alimentation seule rarement suffisante)">
                        <Sparkles className="h-2.5 w-2.5" /> Essentiel
                      </span>
                    )}
                    {gap && (
                      <span className="text-[9px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400" title={`Carence détectée dans ta dernière prise: ${gap.biomarker}`}>
                        <Activity className="h-2.5 w-2.5" /> Carence prise de sang
                      </span>
                    )}
                    {!gap && c.target.primarySource === "food" && (
                      <span className="text-[9px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-card border border-border/60 text-muted-foreground" title="Source principale: alimentation">
                        <Apple className="h-2.5 w-2.5" /> alim.
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-base font-semibold tabular-nums leading-none ${meta.color}`}>
                    {format(totalIntake)}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">{c.unit}/j</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {format(dietary)} alim. + {format(fromSup)} suppl.
                  </div>
                </div>
              </div>

              {/* Stacked bar */}
              <div className="relative pt-3 pb-4">
                {/* Optimal range bracket above bar */}
                <div className="absolute top-0 -translate-y-0.5 text-[8px] text-emerald font-mono tabular-nums whitespace-nowrap"
                     style={{ left: `${optMinPct}%`, width: `${optMaxPct - optMinPct}%` }}>
                  <div className="flex items-center w-full">
                    <span className="h-2 w-px bg-emerald/60" />
                    <span className="flex-1 h-px bg-emerald/40" />
                    <span className="px-1 text-[8px] text-emerald uppercase tracking-wider whitespace-nowrap">Optimal</span>
                    <span className="flex-1 h-px bg-emerald/40" />
                    <span className="h-2 w-px bg-emerald/60" />
                  </div>
                </div>

                {/* Bar background + emerald optimal zone overlay */}
                <div className="relative h-3 w-full rounded-md bg-secondary/40 overflow-hidden">
                  {/* Optimal range subtle overlay */}
                  <div className="absolute inset-y-0 bg-emerald/15 border-x border-emerald/30"
                       style={{ left: `${optMinPct}%`, width: `${optMaxPct - optMinPct}%` }} />
                  {/* Diet portion (sky) */}
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${dietPct}%` }} transition={{ duration: 0.4, delay: 0.05 + i * 0.02 }}
                    className="absolute inset-y-0 left-0 bg-sky-500/70"
                  />
                  {/* Supplement portion (emerald) — stacks on top of diet */}
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${supPct}%` }} transition={{ duration: 0.4, delay: 0.15 + i * 0.02 }}
                    className="absolute inset-y-0 bg-emerald"
                    style={{ left: `${dietPct}%` }}
                  />
                </div>

                {/* Tick labels below bar */}
                <div className="relative h-3 mt-0.5">
                  <div className="absolute -translate-x-1/2 text-[8px] text-emerald font-mono tabular-nums" style={{ left: `${optMinPct}%` }}>{opt[0]}</div>
                  <div className="absolute -translate-x-1/2 text-[8px] text-emerald font-mono tabular-nums" style={{ left: `${optMaxPct}%` }}>{opt[1]}</div>
                  <div className="absolute right-0 text-[8px] text-red-400/70 font-mono tabular-nums">{max}</div>
                </div>
              </div>

              {/* Status text */}
              <div className="text-[11px] leading-relaxed">
                {inOptimal && <span className="text-emerald">✓ Total dans la plage optimale</span>}
                {aboveOptimal && totalIntake < max && <span className="text-sky-400">↑ Au-dessus de la cible (sans danger)</span>}
                {totalIntake >= max && <span className="text-red-400">⚠ Au-dessus du plafond — réduire</span>}
                {belowOptimal && c.target.primarySource === "food" && !gap && (
                  <span className="text-muted-foreground">Apport alimentaire seul devrait suffire — supplément en bonus.</span>
                )}
                {belowOptimal && (c.target.primarySource === "supplement" || c.target.primarySource === "both") && !gap && (
                  <span className="text-amber-400">↓ Sous l'optimal — augmente la dose ou ajoute un supplément.</span>
                )}
                {gap && (
                  <span className="text-red-400 font-medium">↓ Ta dernière prise indique une carence — augmente la dose.</span>
                )}
              </div>

              {/* Sources line */}
              {c.contributions.length > 0 && (
                <div className="text-[10px] text-muted-foreground/80 border-t border-border/40 pt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="font-medium">Source supplément :</span>
                  {c.contributions.map((ct, j) => (
                    <span key={j} className="font-mono">{ct.supplementName.length > 18 ? ct.supplementName.slice(0, 18) + "…" : ct.supplementName} <span className="text-muted-foreground/60">+{format(ct.daily)}{c.unit}</span></span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, AlertTriangle, Check, ArrowUp, ArrowDown, Activity, Apple } from "lucide-react";

type Coverage = {
  key: string;
  label: string;
  unit: "mg" | "mcg" | "g" | "IU";
  amount: number;
  target: { label: string; unit: string; low: number; optimal: [number, number]; high: number; notes?: string; primarySource?: "food" | "supplement" | "both" };
  status: "low" | "optimal" | "above-optimal" | "high" | "complement";
  contributions: { supplementId: number; supplementName: string; rawAmount: number; rawUnit: string; daily: number }[];
};

type BloodHelp = { biomarker: string; status: string; nutrient: string };

type Resp = {
  coverage: Coverage[];
  summary: { low: number; optimal: number; "above-optimal": number; high: number };
  activeCount: number;
};

const STATUS_META = {
  low: { label: "Sous-dosé", color: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/5", fill: "bg-amber-400", icon: ArrowDown },
  optimal: { label: "Optimal", color: "text-emerald", border: "border-emerald/40", bg: "bg-emerald/5", fill: "bg-emerald", icon: Check },
  "above-optimal": { label: "Au-dessus", color: "text-sky-400", border: "border-sky-500/40", bg: "bg-sky-500/5", fill: "bg-sky-400", icon: ArrowUp },
  high: { label: "Excessif", color: "text-red-400", border: "border-red-500/40", bg: "bg-red-500/5", fill: "bg-red-500", icon: AlertTriangle },
  complement: { label: "Complément", color: "text-sky-300", border: "border-sky-500/30", bg: "bg-card", fill: "bg-sky-300/70", icon: Apple },
};

function format(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

// Simple nutrient → biomarker hint mapping for "comble une carence" tagging.
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

  // Map each nutrient to whether it fills a gap from the last blood test
  function fillsGap(key: string): BloodHelp | null {
    const linked = NUTRIENT_TO_BIOMARKER[key];
    if (!linked) return null;
    return bloodHelp.find((b) => linked.includes(b.biomarker) && (b.status === "attention" || b.status === "slightly-off" || b.status === "low")) ?? null;
  }

  return (
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-emerald" />
            <h2 className="text-base font-semibold">Bilan nutritionnel de ta stack</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Apport quotidien <span className="font-medium text-foreground">via les suppléments uniquement</span> — l'alimentation n'est pas comptée. Pour les nutriments majoritairement alimentaires (potassium, lutéine, choline, vitamine C…), un apport modeste apparaît comme <span className="text-sky-300">Complément</span> (ce qui est normal). Pour les nutriments difficiles à obtenir via la nourriture (D3, B12, oméga-3), on évalue par rapport à la cible.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
          {sum.optimal > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald/15 border border-emerald/30 text-emerald">{sum.optimal} optimal</span>}
          {(sum as any).complement > 0 && <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300">{(sum as any).complement} complément alimentaire</span>}
          {sum.low > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">{sum.low} sous-dosé{sum.low > 1 ? "s" : ""}</span>}
          {sum["above-optimal"] > 0 && <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400">{sum["above-optimal"]} au-dessus</span>}
          {sum.high > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">{sum.high} excessif{sum.high > 1 ? "s" : ""}</span>}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {data.coverage.map((c, i) => {
          const meta = STATUS_META[c.status];
          const Icon = meta.icon;
          const opt = c.target.optimal;
          const max = c.target.high;
          // Bar uses target.high as the "100%" right edge.
          // User fill: how full are they relative to plafond.
          const fillPct = Math.max(0, Math.min(100, (c.amount / max) * 100));
          // Zone boundaries (% of max)
          const lowPct = (c.target.low / max) * 100;
          const optMinPct = (opt[0] / max) * 100;
          const optMaxPct = (opt[1] / max) * 100;
          const gap = fillsGap(c.key);

          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
              className={`rounded-md border ${meta.border} ${meta.bg} p-3 space-y-2`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${meta.color} ${meta.border}`}>{meta.label}</span>
                    {c.target.primarySource === "food" && (
                      <span className="text-[9px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-card border border-border/60 text-muted-foreground" title="Source principale: alimentation">
                        <Apple className="h-2.5 w-2.5" /> alimentation
                      </span>
                    )}
                    {c.target.primarySource === "supplement" && (
                      <span className="text-[9px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-card border border-border/60 text-muted-foreground" title="Difficile à obtenir via l'alimentation seule">
                        💊 supplémentation requise
                      </span>
                    )}
                    {gap && (
                      <span className="text-[9px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald/15 border border-emerald/30 text-emerald" title={`Comble la carence ${gap.biomarker}`}>
                        <Activity className="h-2.5 w-2.5" /> Comble une carence
                      </span>
                    )}
                  </div>
                  {c.target.notes && <div className="text-[10px] text-muted-foreground italic mt-0.5">{c.target.notes}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-base font-semibold tabular-nums leading-none ${meta.color}`}>{format(c.amount)}</div>
                  <div className="text-[10px] text-muted-foreground">{c.unit}/jour</div>
                </div>
              </div>

              {/* Smart fill bar with zone backgrounds */}
              <div className="relative">
                <div className="relative h-4 w-full rounded-md bg-secondary/40 overflow-hidden">
                  {/* Zone backgrounds (subtle) */}
                  <div className="absolute inset-y-0 bg-amber-500/15" style={{ left: 0, width: `${lowPct}%` }} />
                  <div className="absolute inset-y-0 bg-emerald/20" style={{ left: `${optMinPct}%`, width: `${optMaxPct - optMinPct}%` }} />
                  <div className="absolute inset-y-0 bg-sky-500/15" style={{ left: `${optMaxPct}%`, right: 0 }} />
                  {/* User fill (solid color, status-tinted) */}
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${fillPct}%` }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 + i * 0.02 }}
                    className={`absolute inset-y-0 left-0 ${meta.fill} opacity-90`}
                  />
                  {/* End cap on user fill */}
                  <motion.div
                    initial={{ left: 0, opacity: 0 }} animate={{ left: `${fillPct}%`, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 + i * 0.02 }}
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/80 -translate-x-px"
                  />
                </div>
                {/* Tick marks below bar */}
                <div className="relative h-3 mt-0.5 text-[8px] text-muted-foreground font-mono tabular-nums">
                  <div className="absolute -translate-x-1/2" style={{ left: `${lowPct}%` }}>{c.target.low}</div>
                  <div className="absolute -translate-x-1/2 text-emerald" style={{ left: `${optMinPct}%` }}>{opt[0]}</div>
                  <div className="absolute -translate-x-1/2 text-emerald" style={{ left: `${optMaxPct}%` }}>{opt[1]}</div>
                  <div className="absolute right-0 text-red-400/70">{max}</div>
                </div>
              </div>

              {/* Sources line — compact */}
              {c.contributions.length > 0 && (
                <div className="text-[10px] text-muted-foreground/80 border-t border-border/40 pt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="font-medium">Sources :</span>
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

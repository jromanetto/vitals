"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, ChevronDown, ChevronUp, AlertTriangle, Check, ArrowUp, ArrowDown } from "lucide-react";

type Coverage = {
  key: string;
  label: string;
  unit: "mg" | "mcg" | "g" | "IU";
  amount: number;
  target: { label: string; unit: string; low: number; optimal: [number, number]; high: number; notes?: string };
  status: "low" | "optimal" | "above-optimal" | "high";
  contributions: { supplementId: number; supplementName: string; rawAmount: number; rawUnit: string; daily: number }[];
};

type Resp = {
  coverage: Coverage[];
  summary: { low: number; optimal: number; "above-optimal": number; high: number };
  activeCount: number;
};

const STATUS_META = {
  low: { label: "Sous-dosé", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/5", icon: ArrowDown },
  optimal: { label: "Optimal", color: "text-emerald", border: "border-emerald/30", bg: "bg-emerald/5", icon: Check },
  "above-optimal": { label: "Au-dessus", color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/5", icon: ArrowUp },
  high: { label: "Excessif", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/5", icon: AlertTriangle },
};

function format(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function SupplementCoverage({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<Resp | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/supplements/coverage").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, [refreshKey]);

  if (!data || data.coverage.length === 0) return null;

  const total = data.coverage.length;
  const visible = expanded ? data.coverage : data.coverage.slice(0, 4);
  const sum = data.summary;

  return (
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-emerald" />
          <h2 className="text-sm font-medium">Bilan nutritionnel de ta stack ({total})</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {sum.optimal > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald/15 border border-emerald/30 text-emerald">{sum.optimal} optimal</span>}
          {sum.low > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">{sum.low} sous-dosé{sum.low > 1 ? "s" : ""}</span>}
          {sum["above-optimal"] > 0 && <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400">{sum["above-optimal"]} au-dessus</span>}
          {sum.high > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">{sum.high} excessif{sum.high > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((c, i) => {
          const meta = STATUS_META[c.status];
          const Icon = meta.icon;
          const opt = c.target.optimal;
          const max = c.target.high;
          // bar position 0-1
          const pct = Math.max(0, Math.min(1, c.amount / max));
          const lowPos = c.target.low / max;
          const optMin = opt[0] / max;
          const optMax = opt[1] / max;
          const isOpen = openKey === c.key;

          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`rounded-md border ${meta.border} ${meta.bg} px-3 py-2.5`}
            >
              <button onClick={() => setOpenKey(isOpen ? null : c.key)} className="w-full flex items-center gap-3 text-left">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                <span className="text-sm font-medium shrink-0">{c.label}</span>
                <span className={`text-[10px] uppercase tracking-wider ${meta.color} shrink-0`}>{meta.label}</span>
                <span className="text-xs font-mono text-muted-foreground ml-auto shrink-0 tabular-nums">
                  {format(c.amount)} {c.unit}
                  <span className="opacity-50"> / cible {opt[0]}–{opt[1]} {c.unit}</span>
                </span>
                {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
              </button>

              {/* Range bar */}
              <div className="mt-2 relative h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                {/* low zone (0..low) */}
                <div className="absolute inset-y-0 left-0 bg-amber-500/20" style={{ width: `${lowPos * 100}%` }} />
                {/* optimal zone */}
                <div className="absolute inset-y-0 bg-emerald/30" style={{ left: `${optMin * 100}%`, width: `${(optMax - optMin) * 100}%` }} />
                {/* above-optimal zone (optMax..1) */}
                <div className="absolute inset-y-0 bg-sky-500/20" style={{ left: `${optMax * 100}%`, right: 0 }} />
                {/* user marker */}
                <div className={`absolute top-1/2 -translate-y-1/2 h-3 w-1 rounded-sm ${c.status === "low" ? "bg-amber-400" : c.status === "optimal" ? "bg-emerald" : c.status === "above-optimal" ? "bg-sky-400" : "bg-red-400"}`}
                     style={{ left: `${pct * 100}%` }} />
              </div>

              {isOpen && (
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  {c.target.notes && <div className="text-muted-foreground italic">{c.target.notes}</div>}
                  <div className="text-muted-foreground">
                    Apport quotidien : <span className="text-foreground font-mono">{format(c.amount)} {c.unit}</span> · cible <span className="text-emerald font-mono">{opt[0]}–{opt[1]} {c.unit}</span> · plafond <span className="text-red-400 font-mono">{max} {c.unit}</span>
                  </div>
                  {c.contributions.length > 0 && (
                    <div className="border-t border-border/40 pt-1.5 space-y-0.5">
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Sources</div>
                      {c.contributions.map((ct, j) => (
                        <div key={j} className="flex items-center justify-between gap-2">
                          <span className="truncate">{ct.supplementName}</span>
                          <span className="text-muted-foreground font-mono shrink-0">+{format(ct.daily)} {c.unit}/j</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {total > 4 && (
        <button onClick={() => setExpanded(!expanded)} className="mt-3 text-xs text-muted-foreground hover:text-emerald transition flex items-center gap-1">
          {expanded ? <><ChevronUp className="h-3 w-3" /> Réduire</> : <><ChevronDown className="h-3 w-3" /> Voir les {total - 4} nutriments restants</>}
        </button>
      )}
    </motion.section>
  );
}

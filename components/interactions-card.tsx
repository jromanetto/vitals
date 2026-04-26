"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

type Interaction = {
  level: "high" | "moderate" | "info";
  pair: [string, string];
  effect: string;
  recommendation: string;
};

const ICONS = { high: ShieldAlert, moderate: AlertTriangle, info: Info };
const STYLES = {
  high: "border-red-500/40 bg-red-500/10",
  moderate: "border-amber-500/40 bg-amber-500/10",
  info: "border-blue-500/40 bg-blue-500/10",
};
const COLORS = { high: "text-red-400", moderate: "text-amber-400", info: "text-blue-400" };

export function InteractionsCard() {
  const [data, setData] = useState<{ interactions: Interaction[]; supplementCount: number; medicationCount: number } | null>(null);
  useEffect(() => {
    fetch("/api/interactions").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return null;
  if (data.interactions.length === 0) {
    return (
      <section className="rounded-xl border border-emerald/20 bg-emerald/5 p-5">
        <h2 className="text-sm font-medium flex items-center gap-2"><Info className="h-3.5 w-3.5 text-emerald" />Aucune interaction détectée</h2>
        <p className="text-xs text-muted-foreground mt-1.5">Vérifié sur {data.supplementCount} suppléments × {data.medicationCount} médicaments du profile. Liste interne (pas exhaustive).</p>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" />Interactions à surveiller ({data.interactions.length})</h2>
      {data.interactions.map((it, i) => {
        const Icon = ICONS[it.level];
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className={`rounded-xl border p-4 ${STYLES[it.level]}`}>
            <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${COLORS[it.level]}`}>
              <Icon className="h-3 w-3" />
              {it.level === "high" ? "Risque élevé" : it.level === "moderate" ? "Modéré" : "Info"}
            </div>
            <div className="font-medium mt-2 text-sm">{it.pair[0]} + {it.pair[1]}</div>
            <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{it.effect}</div>
            <div className="text-xs mt-2 leading-relaxed"><strong>→</strong> {it.recommendation}</div>
          </motion.div>
        );
      })}
    </section>
  );
}

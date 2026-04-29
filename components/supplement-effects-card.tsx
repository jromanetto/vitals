"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";
import Link from "next/link";

type Effect = {
  supplementId: number; supplement: string; startedAt: number;
  targetBiomarker: string; biomarkerName: string;
  before: { value: number; date: number; unit: string | null } | null;
  after: { value: number; date: number; unit: string | null } | null;
  changeAbs: number | null; changePct: number | null;
  direction: "improving" | "worsening" | "flat" | "unknown";
};

export function SupplementEffectsCard() {
  const [effects, setEffects] = useState<Effect[] | null>(null);
  useEffect(() => { fetch("/api/supplements/effects").then((r) => r.json()).then((d) => setEffects(d.effects ?? [])); }, []);

  if (effects === null) return null;
  if (effects.length === 0) return null;

  const withBefore = effects.filter((e) => e.before && e.after);
  if (withBefore.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald" />Effets des suppléments</h2>
        <p className="text-xs text-muted-foreground mt-2">Aucune mesure disponible avant ET après le démarrage de tes suppléments. Lie un biomarqueur à un supplément (champ "target_biomarker") puis fais un nouveau bilan pour voir l'évolution.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium flex items-center gap-2 mb-4"><TrendingUp className="h-4 w-4 text-emerald" />Effets des suppléments ({withBefore.length})</h2>
      <div className="space-y-2">
        {withBefore.map((e, i) => (
          <motion.div key={e.supplementId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-center p-3 rounded-md bg-secondary/30 border border-border">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{e.supplement}</div>
              <Link href={`/biomarkers/${e.targetBiomarker}`} className="text-xs text-muted-foreground hover:text-emerald">{e.biomarkerName}</Link>
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {e.before!.value} {e.before!.unit ?? ""} <span className="opacity-50">→</span> {e.after!.value} {e.after!.unit ?? ""}
            </div>
            <div className={`text-xs font-mono inline-flex items-center gap-1 ${
              e.direction === "improving" ? "text-emerald" :
              e.direction === "worsening" ? "text-red-400" :
              "text-muted-foreground"
            }`}>
              {e.direction === "improving" ? <ArrowDown className="h-3 w-3" /> :
               e.direction === "worsening" ? <ArrowUp className="h-3 w-3" /> :
               <Minus className="h-3 w-3" />}
              {e.changePct! > 0 ? "+" : ""}{e.changePct!.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">
              depuis {new Date(e.startedAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

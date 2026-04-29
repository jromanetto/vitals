"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Stethoscope, AlertCircle } from "lucide-react";

type Reco = {
  slug: string; name: string; category: string;
  reason: string; priority: "high" | "moderate" | "info";
  triggers: { rsid?: string; trait?: string; ageGate?: number; whyMissing?: string }[];
};

const PRIORITY_CLASS = {
  high: "border-red-500/30 bg-red-500/5",
  moderate: "border-amber-500/30 bg-amber-500/5",
  info: "border-emerald/30 bg-emerald/5",
};

export function MissingBiomarkersCard() {
  const [data, setData] = useState<{ recommendations: Reco[]; age: number | null; measuredCount: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { fetch("/api/recommendations").then((r) => r.json()).then(setData); }, []);

  if (!data) return null;
  if (data.recommendations.length === 0) {
    return (
      <section className="rounded-xl border border-emerald/30 bg-emerald/5 p-5">
        <h2 className="text-sm font-medium flex items-center gap-2"><Stethoscope className="h-4 w-4 text-emerald" />Tu mesures déjà tous les marqueurs recommandés</h2>
        <p className="text-xs text-muted-foreground mt-2">{data.measuredCount} biomarqueurs uniques dans ton historique. Excellent.</p>
      </section>
    );
  }

  const visible = expanded ? data.recommendations : data.recommendations.slice(0, 5);
  const high = data.recommendations.filter((r) => r.priority === "high").length;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-emerald" />
          Marqueurs à demander au prochain bilan ({data.recommendations.length})
        </h2>
        {high > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {high} priorité haute
          </span>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((r, i) => (
          <motion.div key={r.slug} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className={`p-3 rounded-md border ${PRIORITY_CLASS[r.priority]}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm capitalize">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.reason}</div>
                {r.triggers.length > 0 && r.triggers.some((t) => t.rsid) && (
                  <div className="text-[10px] mt-1.5 flex flex-wrap gap-1">
                    {r.triggers.filter((t) => t.rsid).map((t, j) => (
                      <span key={j} className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {t.rsid} · {t.trait?.slice(0, 30)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {r.priority === "high" ? "haute" : r.priority === "moderate" ? "modérée" : "info"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      {data.recommendations.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1">
          {expanded ? "Masquer" : `Voir les ${data.recommendations.length - 5} autres →`}
        </button>
      )}
    </section>
  );
}

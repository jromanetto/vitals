"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";

type Hit = {
  symptomKey: string;
  vsKey: string;
  vsKind: "biomarker" | "supplement" | "habit" | "symptom";
  rho: number; p: number; n: number;
  direction: "positive" | "negative";
};

type Resp = {
  correlations: Hit[];
  labels: { symptoms: Record<string, string>; habits: Record<string, string> };
  biomarkerNames: Record<string, string>;
  note?: string;
};

export default function CorrelationsPage() {
  const [data, setData] = useState<Resp | null>(null);
  useEffect(() => { fetch("/api/correlations").then((r) => r.json()).then(setData); }, []);

  if (!data) return <div className="text-muted-foreground">Calcul des corrélations…</div>;

  function vsLabel(h: Hit): string {
    if (h.vsKind === "biomarker") return data!.biomarkerNames[h.vsKey] ?? h.vsKey;
    if (h.vsKind === "habit") return data!.labels.habits[h.vsKey] ?? h.vsKey;
    if (h.vsKind === "symptom") return data!.labels.symptoms[h.vsKey] ?? h.vsKey;
    return h.vsKey;
  }
  function symLabel(k: string): string { return data!.labels.symptoms[k] ?? k; }

  function strength(rho: number): { label: string; cls: string } {
    const a = Math.abs(rho);
    if (a >= 0.7) return { label: "Forte", cls: "text-emerald" };
    if (a >= 0.5) return { label: "Modérée", cls: "text-amber-400" };
    return { label: "Faible", cls: "text-muted-foreground" };
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Corrélations</h1>
        <p className="text-muted-foreground mt-1 text-sm">Spearman rank correlation entre tes symptômes et tes biomarqueurs / habitudes / suppléments.</p>
      </div>

      {data.note && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">{data.note}</div>
        </div>
      )}

      {data.correlations.length === 0 && !data.note && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune corrélation significative trouvée. Continue à logger tes symptômes et habitudes — il faut au moins 5 points pour qu'une corrélation émerge.
        </div>
      )}

      {data.correlations.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Symptôme</th>
                <th className="text-left px-4 py-2.5 font-medium">vs.</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-right px-4 py-2.5 font-medium">ρ (Spearman)</th>
                <th className="text-left px-4 py-2.5 font-medium">Force</th>
                <th className="text-right px-4 py-2.5 font-medium">n</th>
                <th className="text-right px-4 py-2.5 font-medium">p</th>
              </tr>
            </thead>
            <tbody>
              {data.correlations.map((h, i) => {
                const st = strength(h.rho);
                return (
                  <motion.tr key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.4) }}
                             className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-medium">{symLabel(h.symptomKey)}</td>
                    <td className="px-4 py-2.5">{vsLabel(h)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize text-xs">{h.vsKind}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={`inline-flex items-center gap-1 ${h.direction === "positive" ? "text-amber-400" : "text-emerald"}`}>
                        {h.direction === "positive" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {h.rho.toFixed(2)}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-xs ${st.cls}`}>{st.label}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{h.n}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs font-mono">{h.p < 0.001 ? "<0.001" : h.p.toFixed(3)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-muted-foreground rounded-xl border border-border bg-card/50 p-4 leading-relaxed">
        <strong>Note :</strong> Spearman ρ ∈ [-1, 1] mesure une corrélation monotone (pas linéaire). |ρ| ≥ 0.5 = modéré, ≥ 0.7 = fort.
        Une corrélation n'implique pas de causalité. Plus tu loggues, plus le signal devient fiable.
      </div>
    </div>
  );
}

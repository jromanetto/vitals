"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Info, Activity, HeartPulse, Pill, ListChecks, Watch } from "lucide-react";

type Hit = {
  symptomKey: string; vsKey: string;
  vsKind: "biomarker" | "supplement" | "habit" | "symptom" | "wearable";
  rho: number; p: number; n: number;
  direction: "positive" | "negative";
};

type Resp = {
  correlations: Hit[];
  labels: { symptoms: Record<string, string>; habits: Record<string, string>; wearables: Record<string, string> };
  biomarkerNames: Record<string, string>;
  counts?: { symptoms: number; habits: number; supplements: number; wearables: number };
  note?: string;
};

const KIND_ICON = {
  biomarker: Activity, habit: ListChecks, supplement: Pill, symptom: HeartPulse, wearable: Watch,
} as const;

export default function CorrelationsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { fetch("/api/correlations").then((r) => r.json()).then(setData); }, []);

  if (!data) return <div className="text-muted-foreground">Calcul…</div>;

  function vsLabel(h: Hit): string {
    if (h.vsKind === "biomarker") return data!.biomarkerNames[h.vsKey] ?? h.vsKey;
    if (h.vsKind === "habit") return data!.labels.habits[h.vsKey] ?? h.vsKey;
    if (h.vsKind === "symptom") return data!.labels.symptoms[h.vsKey] ?? h.vsKey;
    if (h.vsKind === "wearable") return data!.labels.wearables[h.vsKey] ?? h.vsKey;
    return h.vsKey;
  }
  function leftLabel(h: Hit): string {
    if (h.symptomKey.startsWith("wearable:")) {
      const k = h.symptomKey.replace("wearable:", "");
      return data!.labels.wearables[k] ?? k;
    }
    return data!.labels.symptoms[h.symptomKey] ?? h.symptomKey;
  }
  function leftIcon(h: Hit) {
    if (h.symptomKey.startsWith("wearable:")) return Watch;
    return HeartPulse;
  }

  function strength(rho: number): { label: string; cls: string } {
    const a = Math.abs(rho);
    if (a >= 0.7) return { label: "Forte", cls: "text-emerald" };
    if (a >= 0.5) return { label: "Modérée", cls: "text-amber-400" };
    return { label: "Faible", cls: "text-muted-foreground" };
  }

  const filtered = filter === "all" ? data.correlations : data.correlations.filter((h) => h.vsKind === filter);
  const counts = data.counts;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Corrélations</h1>
        <p className="text-muted-foreground mt-1 text-sm">Spearman entre tes signaux quotidiens. Plus tu loggues, plus c'est fiable.</p>
        {counts && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{counts.symptoms} entrées symptômes</span>
            <span>·</span>
            <span>{counts.habits} habitudes</span>
            <span>·</span>
            <span>{counts.supplements} prises de suppléments</span>
            <span>·</span>
            <span>{counts.wearables} mesures wearable</span>
          </div>
        )}
      </div>

      {data.note && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">{data.note}</div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: "all", label: "Toutes" },
          { id: "biomarker", label: "Biomarqueurs" },
          { id: "wearable", label: "Wearables" },
          { id: "supplement", label: "Suppléments" },
          { id: "habit", label: "Habitudes" },
          { id: "symptom", label: "Symptômes" },
        ].map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${filter === c.id ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Info className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">
            Aucune corrélation significative dans cette catégorie.
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            Continue à logger : il faut au moins 5 paires de données pour qu'une corrélation émerge.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Signal</th>
                <th className="text-left px-4 py-2.5 font-medium">vs.</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-right px-4 py-2.5 font-medium">ρ</th>
                <th className="text-left px-4 py-2.5 font-medium">Force</th>
                <th className="text-right px-4 py-2.5 font-medium">n</th>
                <th className="text-right px-4 py-2.5 font-medium">p</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => {
                const st = strength(h.rho);
                const VsIcon = KIND_ICON[h.vsKind];
                const LeftIcon = leftIcon(h);
                return (
                  <motion.tr key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.4) }}
                             className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-medium">
                      <span className="inline-flex items-center gap-2"><LeftIcon className="h-3.5 w-3.5 text-muted-foreground" />{leftLabel(h)}</span>
                    </td>
                    <td className="px-4 py-2.5">{vsLabel(h)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize text-xs">
                      <span className="inline-flex items-center gap-1.5"><VsIcon className="h-3 w-3" />{h.vsKind}</span>
                    </td>
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
        <strong>Note :</strong> ρ ∈ [-1,1]. |ρ| ≥ 0.5 = modéré, ≥ 0.7 = fort. Direction +/- selon le sens de la relation.
        Une corrélation n'implique pas de causalité. Pour les symptômes × biomarqueurs, l'appariement utilise une fenêtre ±14 jours.
      </div>
    </div>
  );
}

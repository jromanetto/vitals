"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, RefreshCw, Loader2, Target, AlertCircle, Shield, ArrowRight } from "lucide-react";
import { HelpPill } from "@/components/help-pill";

type Action = { title: string; detail: string; priority: "high" | "medium" | "low" };
type Pillar = {
  id: "sommeil" | "sport" | "nutrition";
  label: string; emoji: string;
  status: "good" | "to-improve" | "alert";
  summary: string; goal: string; actions: Action[];
};
type Plan = {
  longevityScore: number | null;
  longevitySummary: string;
  pillars: Pillar[];
  topRisks: string[];
  topStrengths: string[];
  generatedAt: number;
  cached?: boolean;
};

const STATUS_CFG = {
  good:        { label: "Bon",      cls: "border-emerald/30 bg-emerald/5 text-emerald" },
  "to-improve": { label: "À améliorer", cls: "border-amber-500/30 bg-amber-500/5 text-amber-400" },
  alert:       { label: "Alerte",   cls: "border-red-500/30 bg-red-500/5 text-red-400" },
};

const PRIORITY_CFG = {
  high:   { label: "Haute",  cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  medium: { label: "Moyenne", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  low:    { label: "Basse",  cls: "bg-emerald/10 text-emerald border-emerald/20" },
};

export default function ActionPlanPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/action-plan${force ? "?force=1" : ""}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur");
      setPlan(d);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-emerald" /> Plan d'action longévité
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Synthèse de tes biomarqueurs, ADN, suppléments et wearables — 3 piliers actionables : sommeil, sport, nutrition.
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-xs disabled:opacity-50">
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Régénérer
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-12 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-emerald" /> Génération du plan personnalisé…
        </div>
      )}

      {error && !plan && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {plan && (
        <>
          {/* Hero score */}
          <motion.section
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-6 bg-gradient-to-br from-emerald/10 via-card to-card flex flex-col items-center justify-center md:min-w-[200px]">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Score longévité</div>
                <div className="text-5xl font-semibold tabular-nums text-emerald mt-1">
                  {plan.longevityScore ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">/100</div>
              </div>
              <div className="p-6">
                <div className="text-sm leading-relaxed">{plan.longevitySummary}</div>
                <div className="mt-3 text-[10px] text-muted-foreground">
                  Généré le {new Date(plan.generatedAt).toLocaleString("fr-FR")} {plan.cached && "(cache 24h)"}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plan.pillars.map((p, i) => {
              const cfg = STATUS_CFG[p.status];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className={`rounded-2xl border bg-card p-5 space-y-3 ${cfg.cls}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{p.emoji}</span>
                      <h2 className="text-base font-semibold">{p.label}</h2>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-current">{cfg.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{p.summary}</div>
                  <div className="rounded-md bg-secondary/30 border border-border/40 px-3 py-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-emerald mb-0.5">Objectif</div>
                    <div className="text-foreground">{p.goal}</div>
                  </div>
                  <div className="space-y-1.5">
                    {p.actions.map((a, j) => {
                      const pr = PRIORITY_CFG[a.priority];
                      return (
                        <div key={j} className="rounded-md border border-border/40 bg-card/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium">{a.title}</span>
                            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${pr.cls}`}>{pr.label}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{a.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                  <Link
                    href={`/chat?ask=${encodeURIComponent(`Approfondis le pilier ${p.label} de mon plan d'action: ${p.goal}. Donne-moi un protocole détaillé sur 4 semaines avec des étapes hebdomadaires concrètes.`)}`}
                    className="inline-flex items-center gap-1 text-xs text-emerald hover:underline"
                  >
                    Approfondir avec le panel médical <ArrowRight className="h-3 w-3" />
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Risks + Strengths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <h2 className="text-sm font-medium flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-400" /> Points d'attention
              </h2>
              <ul className="space-y-1.5">
                {plan.topRisks.map((r, i) => (
                  <li key={i} className="text-xs leading-relaxed flex items-start gap-2">
                    <span className="text-amber-400 shrink-0">▸</span>
                    <span className="flex-1">{r}</span>
                    <HelpPill question={`Explique-moi en détail ce point d'attention identifié par mon panel: ${r}. Quelles actions concrètes je peux prendre cette semaine ?`} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-emerald/30 bg-emerald/5 p-5">
              <h2 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-emerald" /> Tes forces
              </h2>
              <ul className="space-y-1.5">
                {plan.topStrengths.map((r, i) => (
                  <li key={i} className="text-xs leading-relaxed flex items-start gap-2">
                    <span className="text-emerald shrink-0">▸</span>
                    <span className="flex-1">{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="text-center pt-4">
            <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-emerald hover:underline">
              <Sparkles className="h-4 w-4" /> Discuter du plan complet avec ton panel médical
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

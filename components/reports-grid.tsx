"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText, Heart, Activity, Brain, Apple, Flame, FlaskConical,
  Pill, Stethoscope, Sparkles, Dna, Loader2, Eye, RefreshCw, Printer,
} from "lucide-react";

export type ReportRow = {
  id: number;
  kind: string;
  title: string;
  body: string;
  created_at: number;
  meta: { score?: number; status?: string } | null;
};

const KIND_ICON: Record<string, React.ElementType> = {
  overview: Sparkles,
  longevity: Heart,
  cardiovascular: Heart,
  metabolic: Flame,
  hormonal: FlaskConical,
  nutrition: Apple,
  cognition: Brain,
  inflammation: Activity,
  "dna-deep-dive": Dna,
  "supplement-recommendations": Pill,
  "next-bloodwork-prep": FlaskConical,
  "doctor-pack": Stethoscope,
};

function preview(body: string): string {
  if (!body) return "";
  // strip markdown headings and bullets, take first ~180 chars of meaningful text
  const txt = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`-]+/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (txt.length <= 180) return txt;
  return txt.slice(0, 180).replace(/\s\S*$/, "") + "…";
}

function kindLabel(k: string) {
  return k.replace(/-/g, " ");
}

export function ReportsGrid({ rows }: { rows: ReportRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ id: number; action: "regen" | "pdf" } | null>(null);

  async function regen(r: ReportRow) {
    setBusy({ id: r.id, action: "regen" });
    try {
      const url = r.kind === "doctor-pack" ? "/api/reports/doctor-pack" : "/api/reports/generate";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: r.kind }),
      });
      const d = await res.json();
      if (d.redirect) router.push(d.redirect);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function pdf(r: ReportRow) {
    setBusy({ id: r.id, action: "pdf" });
    const w = window.open(`/reports/${r.id}?print=1`, "_blank");
    if (!w) {
      setBusy(null);
      return;
    }
    // The print=1 page auto-triggers window.print() once loaded.
    setTimeout(() => setBusy(null), 1500);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((r, i) => {
        const Icon = KIND_ICON[r.kind] ?? FileText;
        const generating = !r.body || r.body.length < 30 || r.meta?.status === "generating";
        const score = typeof r.meta?.score === "number" ? r.meta.score : null;
        const isBusy = busy?.id === r.id;
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
            className="group relative rounded-2xl border border-border bg-card p-5 hover:border-emerald/40 transition flex flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-emerald/10 ring-1 ring-emerald/20 text-emerald flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground capitalize">
                    {kindLabel(r.kind)}
                  </div>
                  <h3 className="h-card text-base font-semibold tracking-tight mt-0.5 line-clamp-2">
                    {r.title.replace(/\s*—\s*génération…?\s*$/, "")}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleDateString("fr-FR", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </div>
                </div>
              </div>
              {score !== null && (
                <span className="shrink-0 text-xs font-semibold tabular-nums px-2 py-1 rounded-md bg-emerald/15 text-emerald ring-1 ring-emerald/30">
                  {score}/100
                </span>
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5em]">
              {generating ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Génération en cours…
                </span>
              ) : (
                preview(r.body) || "Aucun aperçu disponible."
              )}
            </p>

            <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-1.5 flex-wrap">
              <Link
                href={`/reports/${r.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald text-white text-xs font-medium hover:brightness-110 transition"
              >
                <Eye className="h-3.5 w-3.5" />
                Lire
              </Link>
              <button
                onClick={() => regen(r)}
                disabled={isBusy || generating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 transition disabled:opacity-50"
                title="Régénérer un nouveau rapport du même type"
              >
                {isBusy && busy?.action === "regen" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Régénérer
              </button>
              <button
                onClick={() => pdf(r)}
                disabled={isBusy || generating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 transition disabled:opacity-50"
                title="Télécharger en PDF"
              >
                {isBusy && busy?.action === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                PDF
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

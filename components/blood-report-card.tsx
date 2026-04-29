"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, RefreshCw, Loader2, ArrowUp, ArrowDown, Minus, Check, AlertCircle, AlertTriangle } from "lucide-react";

type Highlight = { title: string; type: "good" | "warning" | "alert"; detail: string };
type System = { name: string; status: "optimal" | "good" | "to-watch" | "alert"; summary: string; keyMarkers: string[] };
type Action = { priority: "high" | "medium" | "low"; title: string; detail: string };
type Report = {
  synthesis: string;
  headline: string;
  scoreOutOf100: number;
  highlights: Highlight[];
  systems: System[];
  actions: Action[];
  evolution: string;
  panelDate: number;
  prevPanelDate?: number | null;
  markersCount?: number;
  outOfRangeCount?: number;
  optimalCount?: number;
  cached?: boolean;
  generatedAt: number;
};

const HL_CFG = {
  good: { icon: Check, cls: "border-emerald/30 bg-emerald/5", iconCls: "text-emerald" },
  warning: { icon: AlertCircle, cls: "border-amber-500/30 bg-amber-500/5", iconCls: "text-amber-400" },
  alert: { icon: AlertTriangle, cls: "border-red-500/30 bg-red-500/5", iconCls: "text-red-400" },
};

const SYS_CFG = {
  optimal: { label: "Optimal",      cls: "text-emerald", border: "border-emerald/30 bg-emerald/5" },
  good:    { label: "Bon",          cls: "text-sky-400", border: "border-sky-500/30 bg-sky-500/5" },
  "to-watch": { label: "À surveiller", cls: "text-amber-400", border: "border-amber-500/30 bg-amber-500/5" },
  alert:   { label: "Alerte",       cls: "text-red-400", border: "border-red-500/30 bg-red-500/5" },
};

const PR_CFG = {
  high: { label: "Haute",  cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  medium: { label: "Moyenne", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  low: { label: "Basse",  cls: "bg-emerald/10 text-emerald border-emerald/20" },
};

export function BloodReportCard({ panelDate }: { panelDate?: number }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const url = `/api/blood-tests/report${panelDate ? `?date=${panelDate}` : ""}${force ? `${panelDate ? "&" : "?"}force=1` : ""}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur");
      setReport(d);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, [panelDate]); // eslint-disable-line

  if (loading && !report) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-emerald" />
        <span className="text-sm">Génération du compte-rendu IA pour ton dernier bilan…</span>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
        Compte-rendu non disponible : {error}
      </div>
    );
  }

  if (!report) return null;

  const dateStr = new Date(report.panelDate).toLocaleDateString("fr-FR", { dateStyle: "long" });

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-emerald/30 bg-gradient-to-br from-emerald/8 via-card to-card p-5 md:p-6 space-y-5"
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald font-medium">
            <FileSearch className="h-3.5 w-3.5" /> Compte-rendu IA · {dateStr}
          </div>
          <h2 className="text-lg md:text-xl font-semibold mt-1.5 leading-snug max-w-3xl">{report.headline}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">{report.synthesis}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-center px-3">
            <div className="text-3xl font-semibold tabular-nums text-emerald">{report.scoreOutOf100}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</div>
          </div>
          <button onClick={() => load(true)} disabled={refreshing}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-card hover:bg-secondary/40 text-xs text-muted-foreground disabled:opacity-50">
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Régénérer
          </button>
        </div>
      </header>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
        <Stat label="Marqueurs analysés" value={report.markersCount ?? 0} />
        <Stat label="Optimal" value={report.optimalCount ?? 0} cls="text-emerald" />
        <Stat label="Hors plage" value={report.outOfRangeCount ?? 0} cls="text-amber-400" />
        <Stat label="Comparé à" value={report.prevPanelDate ? new Date(report.prevPanelDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
      </div>

      {report.evolution && (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-400 leading-relaxed">
          <span className="font-medium uppercase tracking-wider text-[10px]">Évolution · </span>
          {report.evolution}
        </div>
      )}

      {/* Highlights */}
      {report.highlights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Points saillants</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {report.highlights.map((h, i) => {
              const cfg = HL_CFG[h.type];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className={`rounded-md border ${cfg.cls} p-3 flex items-start gap-2.5`}
                >
                  <Icon className={`h-3.5 w-3.5 ${cfg.iconCls} shrink-0 mt-0.5`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{h.title}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{h.detail}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Systems */}
      {report.systems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Systèmes corporels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {report.systems.map((s, i) => {
              const cfg = SYS_CFG[s.status];
              return (
                <motion.div
                  key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-md border ${cfg.border} p-3 space-y-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">{s.summary}</div>
                  {s.keyMarkers.length > 0 && (
                    <div className="text-[10px] text-muted-foreground/80 font-mono pt-1 border-t border-border/40">
                      {s.keyMarkers.slice(0, 4).join(" · ")}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {report.actions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Actions recommandées</h3>
          <div className="space-y-1.5">
            {report.actions.map((a, i) => {
              const pr = PR_CFG[a.priority];
              return (
                <motion.div
                  key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="rounded-md border border-border/40 bg-card/50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{a.title}</span>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${pr.cls}`}>{pr.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{a.detail}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2">
        Compte-rendu généré le {new Date(report.generatedAt).toLocaleString("fr-FR")} {report.cached && "· depuis le cache (7j)"}
      </div>
    </motion.section>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/50 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

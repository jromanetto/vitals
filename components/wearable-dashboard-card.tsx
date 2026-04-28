"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkline } from "@/components/sparkline";
import { Activity, Calendar, BarChart3, ArrowRight } from "lucide-react";

type SourceStat = { source: string; total: number; days: number; kinds: number; firstDate: string; lastDate: string };
type Resp = { sources: SourceStat[]; series: Record<string, { date: string; value: number }[]> };

const KIND_LABELS: Record<string, string> = {
  hrv: "HRV",
  rhr: "FC repos",
  recovery: "Récupération",
  readiness: "Readiness",
  sleep_total_min: "Sommeil",
  sleep_score: "Score sommeil",
};

const KIND_UNITS: Record<string, string> = {
  hrv: "ms", rhr: "bpm", recovery: "%", readiness: "%", sleep_total_min: "h", sleep_score: "%",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtVal(kind: string, v: number): string {
  if (kind === "sleep_total_min") return `${(v / 60).toFixed(1)}h`;
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

export function WearableDashboardCard({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch("/api/wearables?days=60").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, [refreshKey]);

  if (!data || !data.sources || data.sources.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald" />
          Wearables ingérés
        </h2>
        <Link href="/" className="text-xs text-emerald hover:underline flex items-center gap-1">Voir le dashboard <ArrowRight className="h-3 w-3" /></Link>
      </div>

      <div className={`grid gap-4 ${data.sources.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
        {data.sources.map((src) => {
          const headlineKinds = ["hrv", "rhr", "recovery", "sleep_total_min"].filter((k) => data.series[`${src.source}:${k}`]?.length);
          return (
            <motion.div
              key={src.source}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-emerald/20 bg-emerald/5 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold capitalize">{src.source}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Source wearable</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-emerald">{src.total.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">mesures</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{src.days.toLocaleString()} jours · {fmtDate(src.firstDate)} → {fmtDate(src.lastDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BarChart3 className="h-3 w-3 shrink-0" />
                  <span>{src.kinds} métriques distinctes</span>
                </div>
              </div>

              {headlineKinds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tendance 60 jours</div>
                  <div className={`grid gap-4 ${data.sources.length === 1 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
                    {headlineKinds.map((k) => {
                      const series = data.series[`${src.source}:${k}`];
                      const values = series.map((p) => p.value);
                      const last = values[values.length - 1];
                      return (
                        <div key={k} className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">{KIND_LABELS[k] ?? k}</div>
                          <Sparkline values={values} />
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-mono tabular-nums">{fmtVal(k, last)}</span>
                            <span className="text-[9px] text-muted-foreground">{KIND_UNITS[k] ?? ""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

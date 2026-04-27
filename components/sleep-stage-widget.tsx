"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

type Row = { date: string; kind: string; value: number };

export function SleepStageWidget() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/wearables?days=14").then((r) => r.json()).then((d) => setRows(d.rows ?? []));
  }, []);

  if (rows === null) return null;
  if (rows.length === 0) return null;

  // Aggregate per date
  const byDate: Record<string, { total?: number; deep?: number; rem?: number; awake?: number }> = {};
  for (const r of rows) {
    const day = (byDate[r.date] ??= {});
    if (r.kind === "sleep_total_min") day.total = r.value;
    else if (r.kind === "sleep_deep_min") day.deep = r.value;
    else if (r.kind === "sleep_rem_min") day.rem = r.value;
    else if (r.kind === "sleep_awake_min") day.awake = r.value;
  }
  const days = Object.keys(byDate).sort().slice(-14);
  if (days.length === 0) return null;
  const hasStages = days.some((d) => byDate[d].deep != null || byDate[d].rem != null);
  if (!hasStages) return null;

  const maxTotal = Math.max(...days.map((d) => byDate[d].total ?? 0), 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Sommeil — 14 derniers jours</h2>
        <Link href="/import" className="text-xs text-muted-foreground hover:text-foreground">Import →</Link>
      </div>

      <div className="flex gap-1 h-32 items-end">
        {days.map((d) => {
          const day = byDate[d];
          const total = day.total ?? 0;
          const deep = day.deep ?? 0;
          const rem = day.rem ?? 0;
          const awake = day.awake ?? 0;
          const light = Math.max(0, total - deep - rem - awake);
          const h = total > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <div key={d} className="flex-1 flex flex-col-reverse gap-px" title={`${d} · total ${(total/60).toFixed(1)}h · deep ${(deep/60).toFixed(1)}h · REM ${(rem/60).toFixed(1)}h`}>
              {awake > 0 && <div style={{ height: `${(awake / maxTotal) * 100}%` }} className="bg-amber-500/40 rounded-sm" />}
              {rem > 0 && <div style={{ height: `${(rem / maxTotal) * 100}%` }} className="bg-emerald/50 rounded-sm" />}
              {deep > 0 && <div style={{ height: `${(deep / maxTotal) * 100}%` }} className="bg-emerald rounded-sm" />}
              {light > 0 && <div style={{ height: `${(light / maxTotal) * 100}%` }} className="bg-secondary rounded-sm" />}
              {total === 0 && <div style={{ height: "1%" }} className="bg-secondary/30 rounded-sm" />}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald inline-block" /> Profond</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald/50 inline-block" /> REM</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-secondary inline-block" /> Léger</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500/40 inline-block" /> Éveil</span>
        <span className="ml-auto">→ aujourd'hui</span>
      </div>
    </motion.section>
  );
}

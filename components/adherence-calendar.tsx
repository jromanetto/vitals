"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Rec = { supplementId: number; date: string };

function dateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out.reverse();
}

export function AdherenceCalendar({ supplements }: { supplements: { id: number; name: string; startedAt: number | null }[] }) {
  const [logs, setLogs] = useState<Rec[]>([]);
  useEffect(() => {
    fetch("/api/supplements/log?days=90").then((r) => r.json()).then((d) => setLogs(d.rows ?? []));
  }, [supplements]);

  const days = dateRange(90);
  const taken = new Map<string, Set<number>>();
  for (const r of logs) {
    if (!taken.has(r.date)) taken.set(r.date, new Set());
    taken.get(r.date)!.add(r.supplementId);
  }

  const adherenceRate = (suppId: number, since: Date) => {
    let total = 0, took = 0;
    for (const day of days) {
      if (new Date(day) < since) continue;
      total++;
      if (taken.get(day)?.has(suppId)) took++;
    }
    return total > 0 ? Math.round((took / total) * 100) : 0;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium mb-4">Adhérence — 90 derniers jours</h2>
      <div className="space-y-2">
        {supplements.length === 0 && <div className="text-sm text-muted-foreground py-4">Ajoute des suppléments pour suivre l'adhérence.</div>}
        {supplements.map((s) => {
          const since = s.startedAt ? new Date(s.startedAt) : new Date(0);
          const rate = adherenceRate(s.id, since);
          return (
            <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-xs">
              <div className="w-32 truncate text-muted-foreground shrink-0">{s.name}</div>
              <div className="flex gap-px flex-1">
                {days.map((d) => {
                  const wasActive = !s.startedAt || new Date(d) >= since;
                  const isTaken = taken.get(d)?.has(s.id);
                  return (
                    <div key={d}
                         title={`${d}: ${isTaken ? "✓" : wasActive ? "manqué" : "non actif"}`}
                         className={`flex-1 h-3.5 rounded-sm ${!wasActive ? "bg-secondary/20" : isTaken ? "bg-emerald" : "bg-secondary/50"}`} />
                  );
                })}
              </div>
              <div className={`w-12 text-right font-mono tabular-nums ${rate >= 80 ? "text-emerald" : rate >= 50 ? "text-amber-400" : "text-red-400"}`}>{rate}%</div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

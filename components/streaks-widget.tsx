"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import Link from "next/link";

type Log = { date: string; key: string; value: number };

const LABELS: Record<string, string> = {
  sleep_7h: "Sommeil 7h+", water_2L: "Hydratation 2L+", training: "Sport",
  fasting_14h: "Jeûne 14h+", sun: "Soleil matin", meditation: "Méditation", cold_exposure: "Froid",
};

function dateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  return out;
}

export function StreaksWidget() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  useEffect(() => { fetch("/api/habits?days=120").then((r) => r.json()).then((d) => setLogs(d.rows ?? [])); }, []);

  if (logs === null) return null;
  if (logs.length === 0) {
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.6 }}
                     className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Streaks habitudes</h2>
          <Link href="/habits" className="text-xs text-emerald hover:underline">Voir habitudes →</Link>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Coche tes habitudes du jour pour démarrer un streak.</p>
      </motion.section>
    );
  }

  const days = dateRange(120);
  function streakFor(key: string): number {
    let n = 0;
    const set = new Set(logs!.filter((l) => l.key === key).map((l) => l.date));
    for (const d of days) { if (set.has(d)) n++; else break; }
    return n;
  }

  const streaks = Object.entries(LABELS).map(([k, label]) => ({ k, label, n: streakFor(k) })).filter((s) => s.n > 0).sort((a, b) => b.n - a.n);

  if (streaks.length === 0) return null;

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.6 }}
                   className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Streaks actifs</h2>
        <Link href="/habits" className="text-xs text-muted-foreground hover:text-foreground">Voir tout →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {streaks.slice(0, 8).map((s) => (
          <div key={s.k} className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-lg font-mono">
              <Flame className="h-4 w-4 text-amber-400" />
              <span>{s.n}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 truncate">{s.label}</div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Moon, Droplet, Dumbbell, Clock, Sun, Brain, FlameKindling, Flame } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const HABITS = [
  { key: "sleep_7h", label: "Sommeil ≥ 7h", icon: Moon, target: "≥7 h" },
  { key: "water_2L", label: "Hydratation ≥ 2L", icon: Droplet, target: "≥2 L" },
  { key: "training", label: "Sport / mouvement", icon: Dumbbell, target: "≥30 min" },
  { key: "fasting_14h", label: "Jeûne ≥ 14h", icon: Clock, target: "14-16 h" },
  { key: "sun", label: "Lumière naturelle matin", icon: Sun, target: "10 min" },
  { key: "meditation", label: "Méditation / respiration", icon: Brain, target: "5-10 min" },
  { key: "cold_exposure", label: "Exposition froid", icon: FlameKindling, target: "2-3 min" },
] as const;

type Log = { date: string; key: string; value: number };

function dateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function HabitsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const days = dateRange(60);

  async function load() {
    const r = await fetch("/api/habits?days=60");
    const d = await r.json();
    setLogs(d.rows ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggle(key: string, date: string = today) {
    const has = logs.some((l) => l.date === date && l.key === key);
    if (has) {
      await fetch(`/api/habits?date=${date}&key=${key}`, { method: "DELETE" });
    } else {
      await fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, key, value: 1 }) });
    }
    load();
  }

  function done(key: string, date: string): boolean {
    return logs.some((l) => l.date === date && l.key === key);
  }

  function streak(key: string): number {
    let n = 0;
    for (const d of days) {
      if (done(key, d)) n++;
      else break;
    }
    return n;
  }

  function rate7(key: string): number {
    const last7 = days.slice(0, 7);
    const took = last7.filter((d) => done(key, d)).length;
    return Math.round((took / 7) * 100);
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Habitudes"
        description="Coche ce que tu fais aujourd'hui. Streaks et heatmap 60 jours en dessous."
        icon={<Flame className="h-5 w-5 text-emerald" />}
      />

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium mb-4">Aujourd'hui — {today}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {HABITS.map((h, i) => {
            const Icon = h.icon;
            const isDone = done(h.key, today);
            const s = streak(h.key);
            const r = rate7(h.key);
            return (
              <motion.button
                key={h.key} onClick={() => toggle(h.key)}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className={`flex items-center gap-3 p-3 rounded-md border transition text-left ${isDone ? "bg-emerald/15 border-emerald/40" : "bg-secondary/30 border-border hover:border-emerald/30"}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isDone ? "bg-emerald text-primary-foreground" : "bg-secondary"}`}>
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{h.label}</div>
                  <div className="text-xs text-muted-foreground">{h.target}</div>
                </div>
                <div className="text-right shrink-0">
                  {s > 0 && <div className="text-xs font-mono text-emerald">{s}j 🔥</div>}
                  <div className="text-[10px] text-muted-foreground">{r}% / 7j</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium mb-4">Heatmap 60 jours</h2>
        <div className="space-y-1">
          {HABITS.map((h, i) => (
            <motion.div key={h.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
                        className="flex items-center gap-2 text-xs">
              <div className="w-40 truncate text-muted-foreground shrink-0">{h.label}</div>
              <div className="flex gap-px flex-1">
                {days.slice().reverse().map((d) => (
                  <div key={d} title={`${d}: ${done(h.key, d) ? "✓" : "—"}`}
                       className={`flex-1 h-3.5 rounded-sm ${done(h.key, d) ? "bg-emerald" : "bg-secondary/40"}`} />
                ))}
              </div>
            </motion.div>
          ))}
          <div className="text-[10px] text-muted-foreground text-right mt-1">→ aujourd'hui</div>
        </div>
      </section>
    </div>
  );
}

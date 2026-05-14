"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  HeartPulse, Check, Moon, Droplet, Dumbbell, Clock, Sun, Brain, FlameKindling, ArrowRight,
} from "lucide-react";

const SYMPTOMS = [
  { key: "energy", label: "Énergie", scale: 10 },
  { key: "mood", label: "Humeur", scale: 10 },
  { key: "focus", label: "Focus", scale: 10 },
  { key: "sleep_quality", label: "Sommeil", scale: 10 },
  { key: "gut", label: "Digestion", scale: 10 },
  { key: "skin", label: "Peau", scale: 10 },
  { key: "anxiety", label: "Anxiété (10=max)", scale: 10 },
  { key: "libido", label: "Libido", scale: 10 },
  { key: "hrv", label: "HRV (ms)", scale: null as number | null },
];

const HABITS = [
  { key: "sleep_7h", label: "Sommeil ≥ 7h", icon: Moon, target: "≥7 h" },
  { key: "water_2L", label: "Hydratation ≥ 2L", icon: Droplet, target: "≥2 L" },
  { key: "training", label: "Sport / mouvement", icon: Dumbbell, target: "≥30 min" },
  { key: "fasting_14h", label: "Jeûne ≥ 14h", icon: Clock, target: "14-16 h" },
  { key: "sun", label: "Lumière naturelle matin", icon: Sun, target: "10 min" },
  { key: "meditation", label: "Méditation / respiration", icon: Brain, target: "5-10 min" },
  { key: "cold_exposure", label: "Exposition froid", icon: FlameKindling, target: "2-3 min" },
] as const;

type SymptomLog = { id: number; date: string; key: string; value: number; notes: string | null };
type HabitLog = { date: string; key: string; value: number };

function dateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  return out;
}

export default function DailyPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const days = dateRange(60);

  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [todaySymptoms, setTodaySymptoms] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  async function loadSymptoms() {
    const r = await fetch("/api/symptoms?days=90");
    const d = await r.json();
    const rows: SymptomLog[] = d.rows ?? [];
    setSymptomLogs(rows);
    const today: Record<string, number> = {};
    for (const l of rows) {
      if (l.date === todayStr) today[l.key] = l.value;
    }
    setTodaySymptoms(today);
  }

  async function loadHabits() {
    const r = await fetch("/api/habits?days=60");
    const d = await r.json();
    setHabitLogs(d.rows ?? []);
  }

  useEffect(() => {
    loadSymptoms();
    loadHabits();
  }, []);

  // ----- Symptoms helpers -----
  async function saveSymptom(key: string, value: number) {
    setTodaySymptoms({ ...todaySymptoms, [key]: value });
    await fetch("/api/symptoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, notes: notes || undefined }),
    });
    loadSymptoms();
  }

  function symptomValue(date: string, key: string): number | null {
    const m = symptomLogs.find((l) => l.date === date && l.key === key);
    return m ? m.value : null;
  }

  function symptomColor(value: number | null, scale: number | null, key: string): string {
    if (value == null) return "bg-secondary/30";
    const isReverse = key === "anxiety";
    const max = scale ?? 100;
    const norm = isReverse ? (max - value) / max : value / max;
    if (norm >= 0.8) return "bg-emerald";
    if (norm >= 0.6) return "bg-emerald/70";
    if (norm >= 0.4) return "bg-amber-500/70";
    if (norm >= 0.2) return "bg-amber-500/50";
    return "bg-red-500/60";
  }

  // ----- Habits helpers -----
  async function toggleHabit(key: string, date: string = todayStr) {
    const has = habitLogs.some((l) => l.date === date && l.key === key);
    if (has) {
      await fetch(`/api/habits?date=${date}&key=${key}`, { method: "DELETE" });
    } else {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, key, value: 1 }),
      });
    }
    loadHabits();
  }

  function habitDone(key: string, date: string): boolean {
    return habitLogs.some((l) => l.date === date && l.key === key);
  }

  function habitStreak(key: string): number {
    let n = 0;
    for (const d of days) {
      if (habitDone(key, d)) n++;
      else break;
    }
    return n;
  }

  function habitRate7(key: string): number {
    const last7 = days.slice(0, 7);
    const took = last7.filter((d) => habitDone(key, d)).length;
    return Math.round((took / 7) * 100);
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Quotidien"
        description="Routine + ressenti du jour. Coche tes habitudes et auto-évalue tes symptômes en quelques secondes."
        icon={<HeartPulse className="h-5 w-5 text-emerald" />}
      />

      {/* Today's check-in: habits (left) + symptoms (right) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Habits column */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Habitudes — {todayStr}</h2>
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">Routine</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {HABITS.map((h, i) => {
              const Icon = h.icon;
              const isDone = habitDone(h.key, todayStr);
              const s = habitStreak(h.key);
              const r = habitRate7(h.key);
              return (
                <motion.button
                  key={h.key}
                  onClick={() => toggleHabit(h.key)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className={`flex items-center gap-3 p-3 rounded-md border transition text-left ${
                    isDone
                      ? "bg-emerald/15 border-emerald/40"
                      : "bg-secondary/30 border-border hover:border-emerald/30"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      isDone ? "bg-emerald text-primary-foreground" : "bg-secondary"
                    }`}
                  >
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
        </div>

        {/* Symptoms column */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-sm font-medium">Symptômes — {todayStr}</h2>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note du jour (optionnel)"
              className="text-xs px-2 py-1 max-w-[200px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {SYMPTOMS.map((sym) => (
              <div key={sym.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Link
                    href={`/symptoms/${sym.key}`}
                    className="hover:text-emerald transition inline-flex items-center gap-1"
                  >
                    {sym.label}
                    <ArrowRight className="h-3 w-3 opacity-40" />
                  </Link>
                  <span className="font-mono tabular-nums">{todaySymptoms[sym.key] ?? "—"}</span>
                </div>
                {sym.scale ? (
                  <div className="flex gap-0.5">
                    {Array.from({ length: sym.scale }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => saveSymptom(sym.key, n)}
                        className={`flex-1 h-7 rounded text-[10px] transition ${
                          todaySymptoms[sym.key] === n
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/40 hover:bg-secondary/70"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    type="number"
                    placeholder="Ex: 65 ms"
                    defaultValue={todaySymptoms[sym.key] ?? ""}
                    onBlur={(e) => {
                      if (e.target.value) saveSymptom(sym.key, Number(e.target.value));
                    }}
                    className="px-2 py-1.5"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heatmaps: habits + symptoms side-by-side */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium mb-4">Heatmap habitudes — 60 jours</h2>
          <div className="space-y-1">
            {HABITS.map((h, i) => (
              <motion.div
                key={h.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="flex items-center gap-2 text-xs"
              >
                <div className="w-32 truncate text-muted-foreground shrink-0">{h.label}</div>
                <div className="flex gap-px flex-1">
                  {days
                    .slice()
                    .reverse()
                    .map((d) => (
                      <div
                        key={d}
                        title={`${d}: ${habitDone(h.key, d) ? "✓" : "—"}`}
                        className={`flex-1 h-3.5 rounded-sm ${
                          habitDone(h.key, d) ? "bg-emerald" : "bg-secondary/40"
                        }`}
                      />
                    ))}
                </div>
              </motion.div>
            ))}
            <div className="text-[10px] text-muted-foreground text-right mt-1">→ aujourd'hui</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium mb-4">Heatmap symptômes — 60 jours</h2>
          <div className="space-y-1">
            {SYMPTOMS.map((sym) => (
              <motion.div
                key={sym.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs"
              >
                <Link
                  href={`/symptoms/${sym.key}`}
                  className="w-32 truncate text-muted-foreground hover:text-foreground shrink-0"
                >
                  {sym.label}
                </Link>
                <div className="flex gap-px flex-1">
                  {days
                    .slice()
                    .reverse()
                    .map((d) => {
                      const v = symptomValue(d, sym.key);
                      return (
                        <div
                          key={d}
                          title={`${d}: ${v ?? "?"}`}
                          className={`flex-1 h-3.5 rounded-sm ${symptomColor(v, sym.scale, sym.key)}`}
                        />
                      );
                    })}
                </div>
              </motion.div>
            ))}
            <div className="text-[10px] text-muted-foreground text-right mt-1">→ aujourd'hui</div>
          </div>
        </div>
      </section>

      {/* Detail links */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium mb-4">Voir le détail d'un symptôme</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {SYMPTOMS.map((sym) => (
            <Link
              key={sym.key}
              href={`/symptoms/${sym.key}`}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-secondary/20 hover:bg-secondary/40 hover:border-emerald/30 transition text-xs"
            >
              <span className="truncate">{sym.label}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

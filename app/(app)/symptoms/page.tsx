"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const SYMPTOMS = [
  { key: "energy", label: "Énergie", scale: 10 },
  { key: "mood", label: "Humeur", scale: 10 },
  { key: "focus", label: "Focus", scale: 10 },
  { key: "sleep_quality", label: "Sommeil", scale: 10 },
  { key: "gut", label: "Digestion", scale: 10 },
  { key: "skin", label: "Peau", scale: 10 },
  { key: "anxiety", label: "Anxiété (10=max)", scale: 10 },
  { key: "libido", label: "Libido", scale: 10 },
  { key: "hrv", label: "HRV (ms)", scale: null },
];

type Log = { id: number; date: string; key: string; value: number; notes: string | null };

function dateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function SymptomsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [today, setToday] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const todayStr = new Date().toISOString().slice(0, 10);
  const days = dateRange(60);

  async function load() {
    const r = await fetch("/api/symptoms?days=90");
    const d = await r.json();
    setLogs(d.rows ?? []);
    const todayLogs: Record<string, number> = {};
    for (const l of (d.rows ?? []) as Log[]) {
      if (l.date === todayStr) todayLogs[l.key] = l.value;
    }
    setToday(todayLogs);
  }
  useEffect(() => { load(); }, []);

  async function save(key: string, value: number) {
    setToday({ ...today, [key]: value });
    await fetch("/api/symptoms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, notes: notes || undefined }),
    });
    load();
  }

  function getValue(date: string, key: string): number | null {
    const m = logs.find((l) => l.date === date && l.key === key);
    return m ? m.value : null;
  }

  function colorFor(value: number | null, scale: number | null, key: string): string {
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

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Symptômes</h1>
        <p className="text-muted-foreground mt-1 text-sm">Auto-évaluation rapide quotidienne. Plus tu remplis, mieux les corrélations émergent.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Aujourd'hui — {todayStr}</h2>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note du jour (optionnel)"
                 className="text-xs bg-secondary/40 border border-border rounded-md px-2 py-1 outline-none focus:border-primary w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SYMPTOMS.map((sym) => (
            <div key={sym.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span>{sym.label}</span>
                <span className="font-mono tabular-nums">{today[sym.key] ?? "—"}</span>
              </div>
              {sym.scale ? (
                <div className="flex gap-0.5">
                  {Array.from({ length: sym.scale }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => save(sym.key, n)}
                            className={`flex-1 h-7 rounded text-[10px] transition ${today[sym.key] === n ? "bg-primary text-primary-foreground" : "bg-secondary/40 hover:bg-secondary/70"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <input type="number" placeholder={`Ex: 65 ms`} defaultValue={today[sym.key] ?? ""}
                       onBlur={(e) => { if (e.target.value) save(sym.key, Number(e.target.value)); }}
                       className="w-full bg-secondary/40 border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:border-primary" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium mb-3">Heatmap 60 jours</h2>
        <div className="space-y-1">
          {SYMPTOMS.map((sym) => (
            <motion.div key={sym.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs">
              <div className="w-32 truncate text-muted-foreground shrink-0">{sym.label}</div>
              <div className="flex gap-px flex-1">
                {days.slice().reverse().map((d) => {
                  const v = getValue(d, sym.key);
                  return <div key={d} title={`${d}: ${v ?? "?"}`} className={`flex-1 h-4 rounded-sm ${colorFor(v, sym.scale, sym.key)}`} />;
                })}
              </div>
            </motion.div>
          ))}
          <div className="text-[10px] text-muted-foreground text-right mt-1">→ aujourd'hui</div>
        </div>
      </section>
    </div>
  );
}

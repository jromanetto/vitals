"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkline } from "@/components/sparkline";

type Row = { date: string; kind: string; value: number };

export function RecoveryWidget() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { fetch("/api/wearables?days=30").then((r) => r.json()).then((d) => setRows(d.rows ?? [])); }, []);

  if (rows === null) return null;
  const recovery = rows.filter((r) => r.kind === "recovery" || r.kind === "readiness").sort((a, b) => a.date.localeCompare(b.date));
  if (recovery.length < 2) return null;

  const values = recovery.map((r) => r.value);
  const last = values[values.length - 1];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.55 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">Récupération — 30 jours</h2>
        <span className="text-xs text-muted-foreground">moyenne {avg.toFixed(0)} · dernier {last.toFixed(0)}</span>
      </div>
      <Sparkline values={values} width={500} height={64} trend="flat" />
      <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
        <div className="rounded-md bg-emerald/10 border border-emerald/30 p-2.5 text-center">
          <div className="text-lg font-mono">{values.filter((v) => v >= 67).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald">Vert (≥67)</div>
        </div>
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 text-center">
          <div className="text-lg font-mono">{values.filter((v) => v >= 34 && v < 67).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-amber-400">Jaune</div>
        </div>
        <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2.5 text-center">
          <div className="text-lg font-mono">{values.filter((v) => v < 34).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-red-400">Rouge (&lt;34)</div>
        </div>
      </div>
    </motion.section>
  );
}

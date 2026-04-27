"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkline } from "@/components/sparkline";
import Link from "next/link";

type Row = { date: string; source: string; kind: string; value: number; unit: string | null };

const KIND_LABELS: Record<string, string> = {
  hrv: "HRV",
  rhr: "FC repos",
  sleep_total_min: "Sommeil total",
  sleep_deep_min: "Sommeil profond",
  sleep_rem_min: "Sommeil REM",
  readiness: "Readiness",
  recovery: "Récupération",
  sleep_score: "Score sommeil",
  strain: "Strain",
  steps: "Pas",
  respiratory_rate: "Resp.",
  spo2: "SpO₂",
  skin_temp_dev: "Δ Temp. peau",
};

const FAVORED = ["hrv", "rhr", "sleep_total_min", "recovery"];
// Higher is better for: HRV, recovery, sleep_total. Lower is better for: RHR, strain (within limits).
const HIGHER_BETTER = new Set(["hrv", "recovery", "readiness", "sleep_total_min", "sleep_score", "sleep_deep_min", "sleep_rem_min", "spo2"]);

export function WearableWidget() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/wearables?days=30").then((r) => r.json()).then((d) => setRows(d.rows ?? []));
  }, []);

  if (rows === null) return null;
  if (rows.length === 0) {
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}
                     className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Wearables</h2>
          <Link href="/import" className="text-xs text-emerald hover:underline">Importer →</Link>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Aucune donnée importée. Connecte ton Oura ou Whoop pour voir ton HRV / RHR / sommeil ici.
        </p>
      </motion.section>
    );
  }

  // Group by kind, take last 30 points sorted asc
  const byKind: Record<string, Row[]> = {};
  for (const r of rows) (byKind[r.kind] ??= []).push(r);
  for (const k of Object.keys(byKind)) byKind[k].sort((a, b) => a.date.localeCompare(b.date));

  const present = FAVORED.filter((k) => byKind[k]?.length >= 2);
  if (present.length === 0) return null;

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}
                   className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Wearables — 30 jours</h2>
        <Link href="/import" className="text-xs text-muted-foreground hover:text-foreground">Import →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {present.map((kind) => {
          const series = byKind[kind];
          const values = series.map((r) => r.value);
          const last = values[values.length - 1];
          const first = values[0];
          const diff = ((last - first) / first) * 100;
          const higherBetter = HIGHER_BETTER.has(kind);
          const trend: "up" | "down" | "flat" =
            Math.abs(diff) < 3 ? "flat" : (diff > 0 ? (higherBetter ? "down" : "up") : (higherBetter ? "up" : "down"));
          const isMin = kind.endsWith("_min");
          const display = isMin ? `${(last / 60).toFixed(1)}h` : last.toFixed(1);
          return (
            <div key={kind} className="space-y-1">
              <div className="text-xs text-muted-foreground">{KIND_LABELS[kind] ?? kind}</div>
              <Sparkline values={values} trend={trend === "up" ? "up" : trend === "down" ? "down" : "flat"} />
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-mono">{display}</span>
                <span className={`text-[10px] tabular-nums ${trend === "down" ? "text-red-400" : trend === "up" ? "text-emerald" : "text-muted-foreground"}`}>
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkline } from "@/components/sparkline";

const LABELS: Record<string, string> = {
  "ldl": "LDL", "hba1c": "HbA1c", "ferritine": "Ferritine",
  "vitamine-d-25-oh": "Vitamine D", "crp-ultrasensible-hscrp": "hsCRP",
  "tsh": "TSH", "testosterone-totale": "Testostérone", "homocysteine": "Homocystéine",
};

const LOWER_IS_BETTER = new Set(["ldl", "hba1c", "crp-ultrasensible-hscrp", "homocysteine"]);

type Series = Record<string, { date: number; value: number }[]>;

export function HomeSparklines() {
  const [series, setSeries] = useState<Series | null>(null);
  useEffect(() => {
    fetch("/api/sparklines").then((r) => r.json()).then((d) => setSeries(d.series));
  }, []);

  if (!series) return null;
  const filled = Object.entries(series).filter(([, pts]) => pts.length >= 2);
  if (filled.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium mb-4">Tendances clés</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filled.map(([slug, pts]) => {
          const first = pts[0].value, last = pts[pts.length - 1].value;
          const diff = ((last - first) / first) * 100;
          const lowerBetter = LOWER_IS_BETTER.has(slug);
          const trend: "up" | "down" | "flat" = Math.abs(diff) < 5 ? "flat" : (diff > 0 ? (lowerBetter ? "up" : "down") : (lowerBetter ? "down" : "up"));
          return (
            <Link key={slug} href={`/biomarkers/${slug}`} className="block group">
              <div className="text-xs text-muted-foreground mb-1">{LABELS[slug] ?? slug}</div>
              <Sparkline values={pts.map((p) => p.value)} trend={trend === "up" ? "up" : trend === "down" ? "down" : "flat"} />
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-mono">{last.toFixed(1)}</span>
                <span className={`text-[10px] tabular-nums ${trend === "up" ? "text-red-400" : trend === "down" ? "text-emerald" : "text-muted-foreground"}`}>
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">{pts.length}×</span>
              </div>
            </Link>
          );
        })}
      </div>
    </motion.section>
  );
}

"use client";
import { motion } from "framer-motion";

type Props = {
  value: number;
  refLow: number | null;
  refHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  status: "optimal" | "normal" | "slightly-off" | "attention" | "unknown";
};

const STATUS_COLOR: Record<Props["status"], string> = {
  optimal: "bg-emerald",
  normal: "bg-sky-400",
  "slightly-off": "bg-amber-400",
  attention: "bg-red-500",
  unknown: "bg-muted-foreground",
};

export function BiomarkerStatusBar({ value, refLow, refHigh, longevityLow, longevityHigh, status }: Props) {
  // Determine bar bounds
  const candidates = [refLow, refHigh, longevityLow, longevityHigh, value].filter((n): n is number => n != null && Number.isFinite(n));
  if (candidates.length < 2) return null;
  const dataMin = Math.min(...candidates);
  const dataMax = Math.max(...candidates);
  const span = Math.max(dataMax - dataMin, 1e-6);
  const pad = span * 0.15;
  const lo = Math.max(0, dataMin - pad);
  const hi = dataMax + pad;
  const range = hi - lo;
  const pos = (v: number) => ((v - lo) / range) * 100;

  const labStart = refLow != null ? pos(refLow) : null;
  const labEnd = refHigh != null ? pos(refHigh) : null;
  const longStart = longevityLow != null ? pos(longevityLow) : null;
  const longEnd = longevityHigh != null ? pos(longevityHigh) : null;
  const userPos = pos(value);

  return (
    <div className="relative h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
      {/* Lab range zone (blue tint, wider) */}
      {labStart != null && labEnd != null && (
        <div
          className="absolute inset-y-0 bg-sky-500/15"
          style={{ left: `${Math.max(0, labStart)}%`, width: `${Math.max(0, labEnd - labStart)}%` }}
        />
      )}
      {/* Longevity range zone (emerald tint, narrower, on top) */}
      {longStart != null && longEnd != null && (
        <div
          className="absolute inset-y-0 bg-emerald/35"
          style={{ left: `${Math.max(0, longStart)}%`, width: `${Math.max(0, longEnd - longStart)}%` }}
        />
      )}
      {/* User value marker */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
        className={`absolute top-1/2 -translate-y-1/2 h-3 w-1 rounded-sm ${STATUS_COLOR[status]}`}
        style={{ left: `calc(${Math.min(100, Math.max(0, userPos))}% - 2px)` }}
        title={`Valeur: ${value}`}
      />
    </div>
  );
}

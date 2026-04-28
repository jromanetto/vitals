"use client";
import { motion } from "framer-motion";

type Status = "optimal" | "normal" | "slightly-off" | "attention" | "unknown";

type Props = {
  value: number;
  refLow: number | null;
  refHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  status: Status;
};

function fmtN(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100) return Math.round(v).toString();
  if (abs >= 10) return (Math.round(v * 10) / 10).toString();
  if (abs >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}

const MARKER_COLOR: Record<Status, string> = {
  optimal: "bg-emerald shadow-emerald/40",
  normal: "bg-sky-400 shadow-sky-400/40",
  "slightly-off": "bg-amber-400 shadow-amber-400/40",
  attention: "bg-red-500 shadow-red-500/50",
  unknown: "bg-muted-foreground shadow-muted-foreground/30",
};

const VALUE_TEXT: Record<Status, string> = {
  optimal: "text-emerald",
  normal: "text-sky-400",
  "slightly-off": "text-amber-400",
  attention: "text-red-400",
  unknown: "text-muted-foreground",
};

export function BiomarkerStatusBar({ value, refLow, refHigh, longevityLow, longevityHigh, status }: Props) {
  const candidates = [refLow, refHigh, longevityLow, longevityHigh, value].filter((n): n is number => n != null && Number.isFinite(n));
  if (candidates.length < 2) return null;
  const dataMin = Math.min(...candidates);
  const dataMax = Math.max(...candidates);
  const span = Math.max(dataMax - dataMin, 1e-6);
  // Pad both sides so labels don't sit at the very edges
  const padLeft = span * 0.18;
  const padRight = span * 0.18;
  const lo = Math.max(0, dataMin - padLeft);
  const hi = dataMax + padRight;
  const range = hi - lo;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / range) * 100));

  const labStart = refLow != null ? pct(refLow) : null;
  const labEnd = refHigh != null ? pct(refHigh) : null;
  const longStart = longevityLow != null ? pct(longevityLow) : null;
  const longEnd = longevityHigh != null ? pct(longevityHigh) : null;
  const userPos = pct(value);

  return (
    <div className="space-y-1.5 pt-3 pb-1">
      {/* Bar */}
      <div className="relative h-2.5 w-full rounded-full bg-secondary/50 overflow-visible">
        {/* Lab range zone (sky tint) */}
        {labStart != null && labEnd != null && (
          <div
            className="absolute inset-y-0 bg-sky-500/25 rounded-full"
            style={{ left: `${labStart}%`, width: `${Math.max(0, labEnd - labStart)}%` }}
          />
        )}
        {/* Longevity range zone (emerald, on top) */}
        {longStart != null && longEnd != null && (
          <div
            className="absolute inset-y-0 bg-emerald/40 rounded-full"
            style={{ left: `${longStart}%`, width: `${Math.max(0, longEnd - longStart)}%` }}
          />
        )}
        {/* Tick marks for ref bounds */}
        {refLow != null && (
          <div className="absolute top-full mt-1 -translate-x-1/2 text-[9px] text-sky-400 font-mono tabular-nums whitespace-nowrap" style={{ left: `${labStart}%` }}>
            {fmtN(refLow)}
          </div>
        )}
        {refHigh != null && (
          <div className="absolute top-full mt-1 -translate-x-1/2 text-[9px] text-sky-400 font-mono tabular-nums whitespace-nowrap" style={{ left: `${labEnd}%` }}>
            {fmtN(refHigh)}
          </div>
        )}
        {/* Longevity ticks (only if different from lab) */}
        {longevityLow != null && longevityLow !== refLow && (
          <div className="absolute -top-4 -translate-x-1/2 text-[9px] text-emerald font-mono tabular-nums whitespace-nowrap" style={{ left: `${longStart}%` }}>
            {fmtN(longevityLow)}
          </div>
        )}
        {longevityHigh != null && longevityHigh !== refHigh && (
          <div className="absolute -top-4 -translate-x-1/2 text-[9px] text-emerald font-mono tabular-nums whitespace-nowrap" style={{ left: `${longEnd}%` }}>
            {fmtN(longevityHigh)}
          </div>
        )}
        {/* User value marker with bubble */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: "easeOut" }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${userPos}%` }}
        >
          <div className={`h-3.5 w-3.5 rounded-full border-2 border-background shadow-lg ${MARKER_COLOR[status]}`} />
        </motion.div>
        {/* Value label above marker */}
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          className={`absolute -top-5 -translate-x-1/2 text-[10px] font-mono font-semibold tabular-nums whitespace-nowrap ${VALUE_TEXT[status]}`}
          style={{ left: `${userPos}%` }}
        >
          {fmtN(value)}
        </motion.div>
      </div>
    </div>
  );
}

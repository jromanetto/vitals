"use client";
import { useMemo, useState } from "react";
import { CHART_COLORS } from "@/lib/charts/theme";

export type SparkPoint = { date: string; value: number };

type Props = {
  points: SparkPoint[];
  width?: number;
  height?: number;
  optimalLow?: number | null;
  optimalHigh?: number | null;
  unit?: string | null;
  /** higher value = better (e.g. HDL, vitamin D). Default: false (lower is better, e.g. LDL, hsCRP) */
  higherIsBetter?: boolean;
};

/** Distance to the optimum band; 0 if inside. */
function distanceFromOptimum(v: number, lo: number | null | undefined, hi: number | null | undefined): number {
  if (lo == null || hi == null) return 0;
  if (v < lo) return lo - v;
  if (v > hi) return v - hi;
  return 0;
}

/** Classify the trend over the last ≤6 points relative to optimum band.
 *  - 'toward'  : moving into / closer to the optimum band -> emerald
 *  - 'away'    : drifting out of the band -> amber
 *  - 'flat'    : negligible change -> muted
 */
function classifyTrend(
  pts: SparkPoint[],
  optimalLow?: number | null,
  optimalHigh?: number | null,
  higherIsBetter = false,
): "toward" | "away" | "flat" {
  if (pts.length < 2) return "flat";
  const first = pts[0].value;
  const last = pts[pts.length - 1].value;
  const range = Math.max(...pts.map((p) => p.value)) - Math.min(...pts.map((p) => p.value));
  const refMag = Math.max(Math.abs(first), Math.abs(last), range, 1e-6);
  const change = last - first;
  if (Math.abs(change) / refMag < 0.03) return "flat";

  // If we have an optimum band, use distance.
  if (optimalLow != null && optimalHigh != null) {
    const dFirst = distanceFromOptimum(first, optimalLow, optimalHigh);
    const dLast = distanceFromOptimum(last, optimalLow, optimalHigh);
    if (Math.abs(dLast - dFirst) / refMag < 0.02) return "flat";
    return dLast < dFirst ? "toward" : "away";
  }
  // No band: fall back to higher/lower-is-better heuristic.
  if (higherIsBetter) return change > 0 ? "toward" : "away";
  return change < 0 ? "toward" : "away";
}

export function InlineSparkline({
  points,
  width = 60,
  height = 24,
  optimalLow,
  optimalHigh,
  unit,
  higherIsBetter = false,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const recent = useMemo(() => points.slice(-6), [points]);

  if (recent.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="text-[9px] text-muted-foreground/60 italic flex items-center justify-center"
        title={recent.length === 1 ? "un seul point — refais ce dosage pour voir la tendance" : "pas de tendance"}
      >
        {recent.length === 1 ? "·" : "—"}
      </div>
    );
  }

  const values = recent.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (recent.length - 1);
  const yFor = (v: number) => height - ((v - min) / range) * (height - 6) - 3;
  const polyPoints = recent.map((p, i) => `${i * stepX},${yFor(p.value)}`).join(" ");

  const trend = classifyTrend(recent, optimalLow, optimalHigh, higherIsBetter);
  const color =
    trend === "toward" ? CHART_COLORS.primary :
    trend === "away" ? CHART_COLORS.warning :
    CHART_COLORS.muted;

  const lastIdx = recent.length - 1;
  const hovered = hover != null ? recent[hover] : null;

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="block overflow-visible">
        {/* optimum band shading */}
        {optimalLow != null && optimalHigh != null && optimalHigh >= min && optimalLow <= max && (
          <rect
            x={0}
            y={yFor(Math.min(optimalHigh, max))}
            width={width}
            height={Math.max(1, yFor(Math.max(optimalLow, min)) - yFor(Math.min(optimalHigh, max)))}
            fill={CHART_COLORS.primary}
            opacity={0.08}
          />
        )}
        <polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Hover hit-targets */}
        {recent.map((p, i) => (
          <circle
            key={i}
            cx={i * stepX}
            cy={yFor(p.value)}
            r={6}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer"
          />
        ))}
        {/* visible last dot */}
        <circle cx={lastIdx * stepX} cy={yFor(values[lastIdx])} r={2} fill={color} />
        {/* hover marker */}
        {hover != null && (
          <circle cx={hover * stepX} cy={yFor(recent[hover].value)} r={3} fill={color} stroke="hsl(var(--background))" strokeWidth={1} />
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md border border-border bg-card text-[10px] font-mono whitespace-nowrap shadow-lg"
        >
          <span className="text-foreground tabular-nums">{hovered.value}{unit ? ` ${unit}` : ""}</span>
          <span className="text-muted-foreground ml-1.5">{new Date(hovered.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}</span>
        </div>
      )}
    </div>
  );
}

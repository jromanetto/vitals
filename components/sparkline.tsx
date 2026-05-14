"use client";
import { motion } from "framer-motion";
import { CHART_COLORS } from "@/lib/charts/theme";

export function Sparkline({ values, width = 120, height = 36, trend, responsive }: { values: number[]; width?: number; height?: number; trend?: "up" | "down" | "flat"; responsive?: boolean }) {
  if (!values || values.length === 0) {
    const style = responsive ? { width: "100%", height } : { width, height };
    return <div style={style} className="text-[10px] text-muted-foreground italic flex items-center">no data</div>;
  }
  if (values.length === 1) {
    const style = responsive ? { width: "100%", height } : { width, height };
    return <div style={style} className="text-[10px] text-muted-foreground italic flex items-center">single point</div>;
  }
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  // "up" trend = bad direction (red), "down" = good (emerald), "flat" = muted.
  const color = trend === "up" ? CHART_COLORS.danger : trend === "down" ? CHART_COLORS.primary : CHART_COLORS.muted;

  // When responsive, use a viewBox so the SVG scales to its container instead
  // of overflowing the parent card.
  const svgProps = responsive
    ? { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", style: { width: "100%", height } }
    : { width, height };

  return (
    <svg {...svgProps} className="block max-w-full">
      <motion.polyline
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }}
        points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
      />
      <circle cx={(values.length - 1) * stepX} cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2} r={2.5} fill={color} />
    </svg>
  );
}

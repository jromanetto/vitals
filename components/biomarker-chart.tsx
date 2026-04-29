"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { CHART_COLORS, tooltipStyle, axisStyle } from "@/lib/charts/theme";

type Series = { date: number; value: number; source: string | null }[];

export function BiomarkerChart({
  series, refLow, refHigh, optimalLow, optimalHigh, longevityLow, longevityHigh, unit,
}: {
  series: Series;
  refLow: number | null; refHigh: number | null;
  optimalLow?: number | null; optimalHigh?: number | null;
  longevityLow?: number | null; longevityHigh?: number | null;
  unit: string;
}) {
  const data = series.map((s) => ({ ...s, dateLabel: new Date(s.date).toLocaleDateString("fr-FR", { year: "2-digit", month: "short" }) }));
  const allValues = [
    ...series.map((s) => s.value),
    refLow ?? 0, refHigh ?? 0,
    optimalLow ?? 0, optimalHigh ?? 0,
    longevityLow ?? 0, longevityHigh ?? 0,
  ].filter((v) => Number.isFinite(v) && v !== 0);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const pad = (maxVal - minVal) * 0.1 || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            {refLow != null && refHigh != null && (
              <ReferenceArea y1={refLow} y2={refHigh} fill="hsl(220 5% 50% / 0.06)" stroke="hsl(220 5% 40% / 0.18)" />
            )}
            {optimalLow != null && optimalHigh != null && (
              <ReferenceArea y1={optimalLow} y2={optimalHigh} fill={CHART_COLORS.primary} fillOpacity={0.10} stroke={CHART_COLORS.primary} strokeOpacity={0.25} />
            )}
            {longevityLow != null && longevityHigh != null && (
              <ReferenceArea y1={longevityLow} y2={longevityHigh} fill={CHART_COLORS.primary} fillOpacity={0.20} stroke={CHART_COLORS.primary} strokeOpacity={0.45} />
            )}
            <XAxis dataKey="dateLabel" tick={{ fill: axisStyle.stroke, fontSize: 11 }} stroke={axisStyle.stroke} />
            <YAxis domain={[minVal - pad, maxVal + pad]} tick={{ fill: axisStyle.stroke, fontSize: 11 }} stroke={axisStyle.stroke} />
            <Tooltip contentStyle={tooltipStyle}
                     formatter={(v: number) => [`${v} ${unit}`, "Valeur"]} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2.2} dot={{ r: 3, fill: CHART_COLORS.primary }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-secondary border border-border/40 inline-block" /> Range labo</span>
        {optimalLow != null && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald/15 border border-emerald/30 inline-block" /> Optimal</span>}
        {longevityLow != null && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald/30 border border-emerald/50 inline-block" /> Longévité</span>}
      </div>
    </motion.div>
  );
}

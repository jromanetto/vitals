"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, CartesianGrid } from "recharts";
import { motion } from "framer-motion";

export function BiomarkerChart({
  series, refLow, refHigh, unit,
}: { series: { date: number; value: number; source: string | null }[]; refLow: number | null; refHigh: number | null; unit: string }) {
  const data = series.map((s) => ({ ...s, dateLabel: new Date(s.date).toLocaleDateString("fr-FR", { year: "2-digit", month: "short" }) }));
  const minVal = Math.min(...series.map((s) => s.value), refLow ?? Infinity);
  const maxVal = Math.max(...series.map((s) => s.value), refHigh ?? -Infinity);
  const pad = (maxVal - minVal) * 0.1 || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            {refLow != null && refHigh != null && (
              <ReferenceArea y1={refLow} y2={refHigh} fill="hsl(160 84% 39% / 0.08)" stroke="hsl(160 84% 39% / 0.25)" />
            )}
            <XAxis dataKey="dateLabel" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
            <YAxis domain={[minVal - pad, maxVal + pad]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v} ${unit}`, "Valeur"]}
            />
            <Line type="monotone" dataKey="value" stroke="hsl(160 84% 39%)" strokeWidth={2.2} dot={{ r: 3, fill: "hsl(160 84% 39%)" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

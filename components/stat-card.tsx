"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, hint, accent, delay = 0,
}: {
  label: string; value: React.ReactNode; hint?: string; accent?: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border p-5 bg-card",
        accent && "gradient-emerald"
      )}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}

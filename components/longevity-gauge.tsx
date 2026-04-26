"use client";
import { motion } from "framer-motion";

export function LongevityGauge({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colorFor = (s: number) => {
    if (s >= 80) return "rgb(16, 185, 129)";
    if (s >= 60) return "rgb(132, 204, 22)";
    if (s >= 40) return "rgb(251, 191, 36)";
    return "rgb(248, 113, 113)";
  };

  return (
    <div className="relative w-[180px] h-[180px] flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={radius} stroke="hsl(var(--border))" strokeWidth="10" fill="none" />
        <motion.circle
          cx="90" cy="90" r={radius}
          stroke={colorFor(score)} strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="absolute flex flex-col items-center"
      >
        <span className="text-4xl font-semibold tabular-nums tracking-tight">{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Vitals score</span>
      </motion.div>
    </div>
  );
}

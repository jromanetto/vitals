"use client";
import { motion } from "framer-motion";

type Variant = "stress" | "mood" | "anxiety";

const EMOJIS: Record<Variant, [string, string, string]> = {
  // [low (0), mid (5), high (10)]
  stress: ["😌", "😣", "😫"],
  mood: ["😢", "😐", "😄"],
  anxiety: ["😌", "😟", "😱"],
};

// For mood, "good" is high. For stress/anxiety, "good" is low.
function colorFor(variant: Variant, value: number): string {
  const goodHigh = variant === "mood";
  const score = goodHigh ? value : 10 - value; // 0-10 where 10 = good
  if (score >= 7) return "text-emerald";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}

function trackColor(variant: Variant, value: number): string {
  const goodHigh = variant === "mood";
  const score = goodHigh ? value : 10 - value;
  if (score >= 7) return "rgb(16 185 129)"; // emerald-500
  if (score >= 4) return "rgb(251 191 36)"; // amber-400
  return "rgb(248 113 113)"; // red-400
}

function emojiFor(variant: Variant, value: number): string {
  const [low, mid, high] = EMOJIS[variant];
  if (value <= 3) return low;
  if (value <= 6) return mid;
  return high;
}

export function SliderRating({
  label,
  value,
  onChange,
  variant,
}: {
  label: string;
  value: number | "" | undefined;
  onChange: (v: number) => void;
  variant: Variant;
}) {
  const v = typeof value === "number" ? value : 5;
  const has = typeof value === "number";
  const pct = (v / 10) * 100;
  const color = colorFor(variant, v);
  const track = trackColor(variant, v);

  return (
    <div className="md:col-span-2 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
        <div className="flex items-center gap-2">
          <motion.span
            key={emojiFor(variant, v)}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="text-2xl leading-none"
            aria-hidden
          >
            {emojiFor(variant, v)}
          </motion.span>
          <span className={`tabular-nums text-sm font-medium ${has ? color : "text-muted-foreground"}`}>
            {has ? `${v}/10` : "—"}
          </span>
        </div>
      </div>

      <div className="relative h-8 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-secondary/60 border border-border" />
        {/* Filled portion */}
        <motion.div
          className="absolute left-0 h-1.5 rounded-full"
          style={{ background: track }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        />
        {/* Knob */}
        <motion.div
          className="absolute h-4 w-4 rounded-full bg-foreground shadow-md ring-2 ring-background pointer-events-none"
          style={{ background: track }}
          initial={false}
          animate={{ left: `calc(${pct}% - 8px)` }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        />
        {/* Native range input on top, transparent */}
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label={label}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-0.5">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

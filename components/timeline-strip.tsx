"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { TimelineEvent } from "@/app/api/timeline/route";

type Props = {
  events: TimelineEvent[];
  rangeMs: number; // window length in ms ending now
  onSelect?: (e: TimelineEvent) => void;
};

const MONTH_FR = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "aoû", "sep", "oct", "nov", "déc"];

function startOfMonth(ts: number) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function addMonths(ts: number, n: number) {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

export function TimelineStrip({ events, rangeMs, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [hover, setHover] = useState<TimelineEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const now = Date.now();
  const start = now - rangeMs;
  const filtered = useMemo(
    () => events.filter((e) => e.date >= start && e.date <= now),
    [events, start, now]
  );

  // ticks: months
  const ticks = useMemo(() => {
    const t: { ts: number; label: string }[] = [];
    let cur = startOfMonth(start);
    if (cur < start) cur = addMonths(cur, 1);
    while (cur <= now) {
      const d = new Date(cur);
      const label = `${MONTH_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      t.push({ ts: cur, label });
      cur = addMonths(cur, 1);
    }
    return t;
  }, [start, now]);

  // Decide tick density based on width / count
  const tickStride = useMemo(() => {
    const target = Math.max(4, Math.floor(width / 90));
    return Math.max(1, Math.ceil(ticks.length / target));
  }, [ticks.length, width]);

  function xOf(ts: number) {
    return ((ts - start) / rangeMs) * (width - 32) + 16;
  }

  // Bucketize events into pixel-bins to cluster overlapping dots
  type Cluster = { x: number; events: TimelineEvent[] };
  const clusters = useMemo(() => {
    const binSize = 14; // px
    const bins = new Map<string, Cluster>();
    for (const e of filtered) {
      const x = xOf(e.date);
      const key = `${e.kind}-${Math.round(x / binSize)}`;
      const existing = bins.get(key);
      if (existing) existing.events.push(e);
      else bins.set(key, { x, events: [e] });
    }
    return [...bins.values()];
  }, [filtered, width, rangeMs, start]);

  // Lane assignment by kind for vertical separation
  const LANES: Record<TimelineEvent["kind"], number> = {
    "bilan-sanguin": 0,
    "dna-import": 1,
    "supp-start": 2,
    "supp-end": 2,
    symptom: 3,
    reminder: 4,
    document: 5,
  };
  const LANE_LABELS = ["Bilans", "ADN", "Suppléments", "Symptômes", "Rappels", "Documents"];
  const laneCount = LANE_LABELS.length;
  const laneHeight = 38;
  const stripHeight = laneCount * laneHeight + 36;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg width={width} height={stripHeight} className="overflow-visible">
        {/* lane backgrounds */}
        {LANE_LABELS.map((label, i) => (
          <g key={label}>
            <rect
              x={0}
              y={28 + i * laneHeight}
              width={width}
              height={laneHeight - 4}
              fill={i % 2 === 0 ? "hsl(0 0% 100% / 0.015)" : "transparent"}
              rx={4}
            />
            <text
              x={4}
              y={28 + i * laneHeight + laneHeight / 2 + 3}
              fontSize={9}
              fill="hsl(0 0% 45%)"
              fontFamily="ui-monospace, monospace"
              className="uppercase tracking-wider"
            >
              {label}
            </text>
          </g>
        ))}
        {/* month ticks */}
        {ticks.map((t, i) => {
          const x = xOf(t.ts);
          const showLabel = i % tickStride === 0;
          return (
            <g key={t.ts}>
              <line
                x1={x}
                x2={x}
                y1={20}
                y2={stripHeight - 8}
                stroke="hsl(0 0% 100% / 0.06)"
                strokeWidth={1}
              />
              {showLabel && (
                <text
                  x={x}
                  y={14}
                  fontSize={10}
                  fill="hsl(0 0% 55%)"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {t.label}
                </text>
              )}
            </g>
          );
        })}
        {/* "today" marker */}
        <line
          x1={xOf(now)}
          x2={xOf(now)}
          y1={20}
          y2={stripHeight - 8}
          stroke="hsl(160 84% 39% / 0.6)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {/* events */}
        {clusters.map((c, idx) => {
          const e = c.events[0];
          const lane = LANES[e.kind] ?? 5;
          const cy = 28 + lane * laneHeight + (laneHeight - 4) / 2;
          const r = c.events.length > 1 ? Math.min(8, 4 + Math.log2(c.events.length) * 2) : 5;
          return (
            <motion.g
              key={`${e.kind}-${idx}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.005, 0.4) }}
              onMouseEnter={(ev) => {
                setHover(e);
                const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHoverPos({ x: c.x, y: cy });
              }}
              onMouseLeave={() => {
                setHover(null);
                setHoverPos(null);
              }}
              onClick={() => onSelect?.(e)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={c.x}
                cy={cy}
                r={r + 2}
                fill={e.color}
                opacity={0.18}
              />
              <circle
                cx={c.x}
                cy={cy}
                r={r}
                fill={e.color}
                stroke="hsl(0 0% 8%)"
                strokeWidth={1.5}
              />
              {e.kind === "reminder" && e.done && (
                <text
                  x={c.x}
                  y={cy + 3}
                  fontSize={9}
                  fill="white"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  ✓
                </text>
              )}
              {c.events.length > 1 && (
                <text
                  x={c.x}
                  y={cy + 3}
                  fontSize={9}
                  fill="white"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {c.events.length}
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {hover && hoverPos && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
          style={{
            left: Math.min(Math.max(hoverPos.x - 80, 4), width - 180),
            top: hoverPos.y - 56,
            width: 180,
          }}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {new Date(hover.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div className="text-sm font-medium truncate">{hover.title}</div>
          {hover.subtitle && (
            <div className="text-xs text-muted-foreground truncate">{hover.subtitle}</div>
          )}
        </motion.div>
      )}

      {filtered.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-xs text-muted-foreground">Aucun événement sur cette plage</div>
        </div>
      )}
    </div>
  );
}

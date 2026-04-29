"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { TimelineEvent } from "@/app/api/timeline/route";

type Props = {
  events: TimelineEvent[];
  rangeMs: number;
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const MONTH_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const DAY_FR = ["L", "M", "M", "J", "V", "S", "D"];

export function TimelineHeatmap({ events, rangeMs }: Props) {
  const [hover, setHover] = useState<{ key: string; count: number; x: number; y: number } | null>(null);

  const now = Date.now();
  const start = startOfDay(now - rangeMs);
  const end = startOfDay(now);

  // bucket events per day
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (e.date < start || e.date > now) continue;
      const k = dayKey(e.date);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [events, start, now]);

  // Generate weeks (columns) — start on Monday of the week containing `start`
  const weeks = useMemo(() => {
    const firstDay = new Date(start);
    // Adjust to Monday
    const dayOfWeek = (firstDay.getDay() + 6) % 7; // 0=Mon
    firstDay.setDate(firstDay.getDate() - dayOfWeek);
    const w: Array<Array<{ ts: number; key: string; count: number; inRange: boolean }>> = [];
    let cursor = firstDay.getTime();
    while (cursor <= end) {
      const week: Array<{ ts: number; key: string; count: number; inRange: boolean }> = [];
      for (let dow = 0; dow < 7; dow++) {
        const k = dayKey(cursor);
        week.push({
          ts: cursor,
          key: k,
          count: counts.get(k) ?? 0,
          inRange: cursor >= start && cursor <= end,
        });
        cursor += 86400000;
      }
      w.push(week);
    }
    return w;
  }, [start, end, counts]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const v of counts.values()) if (v > max) max = v;
    return Math.max(1, max);
  }, [counts]);

  function cellColor(count: number, inRange: boolean): string {
    if (!inRange) return "hsl(0 0% 100% / 0.02)";
    if (count === 0) return "hsl(0 0% 100% / 0.04)";
    const intensity = Math.min(1, count / maxCount);
    // emerald scale
    const lightness = 45 - intensity * 20; // 45 -> 25
    const alpha = 0.25 + intensity * 0.75;
    return `hsl(160 84% ${lightness}% / ${alpha})`;
  }

  const cellSize = 11;
  const gap = 2;
  const widthVal = weeks.length * (cellSize + gap) + 28;
  const heightVal = 7 * (cellSize + gap) + 24;

  // Month labels: place label at the first week of each month
  const monthLabels = useMemo(() => {
    const labels: Array<{ x: number; label: string }> = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const firstInRange = week.find((c) => c.inRange);
      if (!firstInRange) return;
      const m = new Date(firstInRange.ts).getMonth();
      if (m !== lastMonth) {
        labels.push({
          x: 28 + i * (cellSize + gap),
          label: MONTH_FR[m],
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg width={widthVal} height={heightVal} className="block">
        {/* Day-of-week labels */}
        {DAY_FR.map((d, i) => (
          (i % 2 === 0) && (
            <text
              key={i}
              x={4}
              y={24 + i * (cellSize + gap) + cellSize - 1}
              fontSize={9}
              fill="hsl(0 0% 55%)"
              fontFamily="ui-monospace, monospace"
            >
              {d}
            </text>
          )
        ))}
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={m.x}
            y={12}
            fontSize={9}
            fill="hsl(0 0% 55%)"
            fontFamily="ui-monospace, monospace"
          >
            {m.label}
          </text>
        ))}
        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((cell, di) => {
            const x = 28 + wi * (cellSize + gap);
            const y = 18 + di * (cellSize + gap);
            return (
              <motion.rect
                key={cell.key + "-" + di}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={cellColor(cell.count, cell.inRange)}
                stroke={cell.count > 0 ? "hsl(160 84% 39% / 0.4)" : "transparent"}
                strokeWidth={0.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: Math.min((wi * 7 + di) * 0.0015, 0.3) }}
                onMouseEnter={() =>
                  setHover({
                    key: cell.key,
                    count: cell.count,
                    x: x + cellSize / 2,
                    y,
                  })
                }
                onMouseLeave={() => setHover(null)}
                style={{ cursor: cell.inRange ? "pointer" : "default" }}
              />
            );
          })
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-card px-2 py-1 shadow-lg"
          style={{
            left: Math.min(hover.x - 60, widthVal - 130),
            top: hover.y - 38,
            width: 130,
          }}
        >
          <div className="text-[10px] text-muted-foreground">
            {new Date(hover.key + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div className="text-xs font-medium">
            {hover.count === 0 ? "Aucun événement" : `${hover.count} événement${hover.count > 1 ? "s" : ""}`}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
        <span>Moins</span>
        {[0, 0.25, 0.5, 0.75, 1].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: `hsl(160 84% ${45 - i * 20}% / ${0.1 + i * 0.9})` }}
          />
        ))}
        <span>Plus</span>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { convertValue } from "@/lib/parsers/normalize-units";

export const runtime = "nodejs";

type Raw = { slug: string; name: string; category: string | null; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number };

type Row = {
  slug: string;
  name: string;
  category: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  valueA: number | null;
  valueB: number | null;
  dateA: number | null;
  dateB: number | null;
};

/** Nearest measurement on/around the target date (±60 days), from an in-memory slug group. */
function valueNearDate(rows: Raw[], target: number): { date: number; value: number } | null {
  const WINDOW_MS = 60 * 86400000;
  let best: { date: number; value: number } | null = null;
  let bestDist = Infinity;
  for (const r of rows) {
    if (r.date < target - WINDOW_MS || r.date > target + WINDOW_MS) continue;
    const dist = Math.abs(r.date - target);
    if (dist < bestDist) { bestDist = dist; best = { date: r.date, value: r.value }; }
  }
  return best;
}

export async function GET(req: Request) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId, viewUserId: viewUserId ?? authUserId,
  });
  const raw = all.rows as Raw[];
  const url = new URL(req.url);

  // Dates that have measurements (descending), with counts.
  const countByDate = new Map<number, number>();
  for (const r of raw) countByDate.set(r.date, (countByDate.get(r.date) ?? 0) + 1);
  const dates = [...countByDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date - a.date);

  if (dates.length === 0) return NextResponse.json({ rows: [], dates: [], dateA: null, dateB: null });

  const defaultA = dates[0]?.date ?? null;
  const defaultB = dates[1]?.date ?? null;
  const dateAParam = url.searchParams.get("dateA");
  const dateBParam = url.searchParams.get("dateB");
  const dateA = dateAParam ? Number(dateAParam) : defaultA;
  const dateB = dateBParam ? Number(dateBParam) : defaultB;

  // Aggregate per slug (MAX of name/category/unit/refs), ordered by name.
  const bySlug = new Map<string, Raw[]>();
  for (const r of raw) {
    const arr = bySlug.get(r.slug) ?? [];
    arr.push(r);
    bySlug.set(r.slug, arr);
  }
  const maxOf = <T>(arr: Raw[], pick: (r: Raw) => T | null): T | null => {
    let m: T | null = null;
    for (const r of arr) { const v = pick(r); if (v != null && (m == null || v > m)) m = v; }
    return m;
  };
  const allSlugs = [...bySlug.entries()]
    .map(([slug, arr]) => ({
      slug,
      name: maxOf(arr, (r) => r.name) ?? slug,
      category: maxOf(arr, (r) => r.category),
      unit: maxOf(arr, (r) => r.unit),
      refLow: maxOf(arr, (r) => r.refLow),
      refHigh: maxOf(arr, (r) => r.refHigh),
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const rows: Row[] = [];
  for (const m of allSlugs) {
    const group = bySlug.get(m.slug) ?? [];
    const a = dateA != null ? valueNearDate(group, dateA) : null;
    const b = dateB != null ? valueNearDate(group, dateB) : null;
    if (!a && !b) continue;
    const meta = META_BY_SLUG[m.slug];
    let optimalLow = meta?.optimalLow ?? null;
    let optimalHigh = meta?.optimalHigh ?? null;
    let longevityLow = meta?.longevityLow ?? null;
    let longevityHigh = meta?.longevityHigh ?? null;
    if (meta && m.unit && m.unit !== meta.unit) {
      const c = (v: number | null) => v == null ? null : convertValue(m.slug, meta.unit, m.unit!, v);
      const newOL = c(optimalLow);
      const newOH = c(optimalHigh);
      const newLL = c(longevityLow);
      const newLH = c(longevityHigh);
      const failed =
        (optimalLow != null && newOL == null) ||
        (optimalHigh != null && newOH == null) ||
        (longevityLow != null && newLL == null) ||
        (longevityHigh != null && newLH == null);
      if (failed) {
        optimalLow = optimalHigh = longevityLow = longevityHigh = null;
      } else {
        optimalLow = newOL;
        optimalHigh = newOH;
        longevityLow = newLL;
        longevityHigh = newLH;
      }
    }
    rows.push({
      slug: m.slug,
      name: m.name,
      category: m.category,
      unit: m.unit ?? meta?.unit ?? null,
      refLow: m.refLow,
      refHigh: m.refHigh,
      optimalLow,
      optimalHigh,
      longevityLow,
      longevityHigh,
      valueA: a?.value ?? null,
      valueB: b?.value ?? null,
      dateA: a?.date ?? null,
      dateB: b?.date ?? null,
    });
  }

  return NextResponse.json({
    dates: dates.map((d) => ({ date: d.date, count: d.count })),
    dateA, dateB,
    rows,
  });
}

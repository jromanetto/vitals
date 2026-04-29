import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { META_BY_SLUG } from "@/lib/biomarker-meta";

export const runtime = "nodejs";

type DateRow = { date: number; count: number };

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

/** Snap to the nearest measurement on/around the target date (within ±60 days), per slug. */
function valueNearDate(sqlite: any, slug: string, target: number): { date: number; value: number } | null {
  const WINDOW_MS = 60 * 86400000;
  const row = sqlite.prepare(
    `SELECT date, value FROM biomarker
     WHERE slug = ? AND date BETWEEN ? AND ?
     ORDER BY ABS(date - ?) ASC LIMIT 1`
  ).get(slug, target - WINDOW_MS, target + WINDOW_MS, target) as { date: number; value: number } | undefined;
  return row ?? null;
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const url = new URL(req.url);

  // Discover the dates that have biomarker measurements (descending), so the UI can offer pickers.
  const dates = sqlite.prepare(
    `SELECT date, COUNT(*) AS count FROM biomarker GROUP BY date ORDER BY date DESC`
  ).all() as DateRow[];

  if (dates.length === 0) return NextResponse.json({ rows: [], dates: [], dateA: null, dateB: null });

  // Default: latest two distinct dates.
  const defaultA = dates[0]?.date ?? null;
  const defaultB = dates[1]?.date ?? null;
  const dateAParam = url.searchParams.get("dateA");
  const dateBParam = url.searchParams.get("dateB");
  const dateA = dateAParam ? Number(dateAParam) : defaultA;
  const dateB = dateBParam ? Number(dateBParam) : defaultB;

  // Get the union of slugs measured on either of the two reference dates (±60 days window via valueNearDate).
  // We seed from rows on the exact target dates then expand via meta. Simpler: union of all slugs ever.
  const allSlugs = sqlite.prepare(
    `SELECT slug, MAX(name) AS name, MAX(category) AS category, MAX(unit) AS unit,
            MAX(ref_low) AS refLow, MAX(ref_high) AS refHigh
     FROM biomarker GROUP BY slug ORDER BY MAX(name)`
  ).all() as Array<{ slug: string; name: string; category: string | null; unit: string | null; refLow: number | null; refHigh: number | null }>;

  const rows: Row[] = [];
  for (const m of allSlugs) {
    const a = dateA != null ? valueNearDate(sqlite, m.slug, dateA) : null;
    const b = dateB != null ? valueNearDate(sqlite, m.slug, dateB) : null;
    if (!a && !b) continue; // not measured anywhere near either target
    const meta = META_BY_SLUG[m.slug];
    rows.push({
      slug: m.slug,
      name: m.name,
      category: m.category,
      unit: m.unit ?? meta?.unit ?? null,
      refLow: m.refLow,
      refHigh: m.refHigh,
      optimalLow: meta?.optimalLow ?? null,
      optimalHigh: meta?.optimalHigh ?? null,
      longevityLow: meta?.longevityLow ?? null,
      longevityHigh: meta?.longevityHigh ?? null,
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

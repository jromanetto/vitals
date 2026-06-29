import { NextResponse } from "next/server";
import { getSession, effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { convertValue } from "@/lib/parsers/normalize-units";

export const runtime = "nodejs";

export async function GET() {
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const d = db();
  // Latest value per slug
  const rows = d.$client.prepare(`
    SELECT b.slug, b.name, b.category, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date, b.source
    FROM biomarker b
    JOIN (
      SELECT slug, MAX(date) AS md FROM biomarker WHERE user_id = ? GROUP BY slug
    ) x ON x.slug = b.slug AND x.md = b.date
    WHERE b.user_id = ?
    ORDER BY LOWER(b.name)
  `).all(userId, userId) as Array<{ slug: string; name: string; category: string | null; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number; source: string | null }>;

  // Dedupe: when multiple rows tie on (slug, max(date)), keep the one with reference data; otherwise the first.
  const bySlug = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const prev = bySlug.get(r.slug);
    if (!prev) { bySlug.set(r.slug, r); continue; }
    const prevHasRef = prev.refLow != null && prev.refHigh != null;
    const curHasRef = r.refLow != null && r.refHigh != null;
    if (curHasRef && !prevHasRef) bySlug.set(r.slug, r);
  }
  const deduped = [...bySlug.values()];

  const enriched = deduped.map((r) => {
    const meta = META_BY_SLUG[r.slug];
    let optimalLow = meta?.optimalLow ?? null;
    let optimalHigh = meta?.optimalHigh ?? null;
    let longevityLow = meta?.longevityLow ?? null;
    let longevityHigh = meta?.longevityHigh ?? null;

    // Convert meta ranges into the user's unit so status + bar plot stays consistent.
    // Without this, a row stored in g/L with meta in mg/dL gets a marker stuck at ~1.5%
    // and status compares raw numbers (1.27 ≤ 70 → "optimal" — wrong).
    if (meta && r.unit && r.unit !== meta.unit) {
      const c = (v: number | null) => v == null ? null : convertValue(r.slug, meta.unit, r.unit!, v);
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

    // 4-level status: optimal (in longevity range) > normal (in lab range or optimal) > slightly-off (within 15% of nearest bound) > attention (significantly out)
    let status: "optimal" | "normal" | "slightly-off" | "attention" | "unknown" = "unknown";
    const nearest = (lo: number | null, hi: number | null): number | null => {
      if (lo == null || hi == null) return null;
      if (r.value < lo) return Math.abs((lo - r.value) / lo);
      if (r.value > hi) return Math.abs((r.value - hi) / hi);
      return 0;
    };
    const inLab = r.refLow != null && r.refHigh != null && r.value >= r.refLow && r.value <= r.refHigh;
    const inLongevity = longevityLow != null && longevityHigh != null && r.value >= longevityLow && r.value <= longevityHigh;
    const inOptimal = optimalLow != null && optimalHigh != null && r.value >= optimalLow && r.value <= optimalHigh;

    if (inLongevity) status = "optimal";
    else if (inOptimal || inLab) status = "normal";
    else {
      const offsetLab = nearest(r.refLow, r.refHigh);
      const offsetOpt = nearest(optimalLow, optimalHigh);
      const offset = offsetLab ?? offsetOpt;
      if (offset == null) status = "unknown";
      else if (offset <= 0.15) status = "slightly-off";
      else status = "attention";
    }

    return { ...r, status, optimalLow, optimalHigh, longevityLow, longevityHigh };
  });
  return NextResponse.json({ rows: enriched });
}

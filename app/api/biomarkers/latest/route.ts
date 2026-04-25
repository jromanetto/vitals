import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const d = db();
  // Latest value per slug
  const rows = d.$client.prepare(`
    SELECT b.slug, b.name, b.category, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date, b.source
    FROM biomarker b
    JOIN (
      SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug
    ) x ON x.slug = b.slug AND x.md = b.date
    ORDER BY LOWER(b.name)
  `).all() as Array<{ slug: string; name: string; category: string | null; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number; source: string | null }>;

  const enriched = rows.map((r) => {
    let status: "low" | "ok" | "high" | "unknown" = "unknown";
    if (r.refLow != null && r.refHigh != null) {
      if (r.value < r.refLow) status = "low";
      else if (r.value > r.refHigh) status = "high";
      else status = "ok";
    }
    return { ...r, status };
  });
  return NextResponse.json({ rows: enriched });
}

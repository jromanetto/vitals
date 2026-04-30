import { NextResponse } from "next/server";
import { getSession, currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

type Point = { date: string; value: number };

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const slugsParam = url.searchParams.get("slugs");
  const sqlite = db().$client;

  // Bulk mode: ?slugs=ldl,hdl,...
  if (slugsParam) {
    const slugs = slugsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) return NextResponse.json({ series: {} });
    const placeholders = slugs.map(() => "?").join(",");
    const rows = sqlite.prepare(
      `SELECT slug, date, value FROM biomarker WHERE user_id = ? AND slug IN (${placeholders}) ORDER BY slug ASC, date ASC`
    ).all(userId, ...slugs) as Array<{ slug: string; date: number; value: number }>;
    const series: Record<string, Point[]> = {};
    for (const slug of slugs) series[slug] = [];
    for (const r of rows) {
      series[r.slug] = series[r.slug] ?? [];
      series[r.slug].push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });
    }
    return NextResponse.json({ series });
  }

  // Single-slug mode (back-compat)
  if (!slug) return NextResponse.json({ points: [] });
  const points = sqlite.prepare(`SELECT date, value FROM biomarker WHERE slug = ? AND user_id = ? ORDER BY date ASC`).all(slug, userId) as Array<{ date: number; value: number }>;
  return NextResponse.json({
    points: points.map((p) => ({ date: new Date(p.date).toISOString().slice(0, 10), value: p.value })),
  });
}

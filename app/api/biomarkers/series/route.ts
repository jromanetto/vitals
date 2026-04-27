import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ points: [] });
  const points = db().$client.prepare(`SELECT date, value FROM biomarker WHERE slug = ? ORDER BY date ASC`).all(slug) as Array<{ date: number; value: number }>;
  return NextResponse.json({
    points: points.map((p) => ({ date: new Date(p.date).toISOString().slice(0, 10), value: p.value })),
  });
}

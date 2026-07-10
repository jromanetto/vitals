import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

type Point = { date: string; value: number };

export async function GET(req: Request) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const slugsParam = url.searchParams.get("slugs");

  // Bulk mode: ?slugs=ldl,hdl,...
  if (slugsParam) {
    const slugs = slugsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) return NextResponse.json({ series: {} });
    const { rows } = await convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId, viewUserId: viewUserId ?? authUserId, slugs,
    });
    const series: Record<string, Point[]> = {};
    for (const s of slugs) series[s] = [];
    for (const r of rows) {
      series[r.slug] = series[r.slug] ?? [];
      series[r.slug].push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });
    }
    return NextResponse.json({ series });
  }

  // Single-slug mode (back-compat)
  if (!slug) return NextResponse.json({ points: [] });
  const { rows } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId, viewUserId: viewUserId ?? authUserId, slugs: [slug],
  });
  return NextResponse.json({
    points: rows.map((p) => ({ date: new Date(p.date).toISOString().slice(0, 10), value: p.value })),
  });
}

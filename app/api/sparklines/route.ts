import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const KEY_SLUGS = ["ldl", "hba1c", "ferritine", "vitamine-d-25-oh", "crp-ultrasensible-hscrp", "tsh", "testosterone-totale", "homocysteine"];

export async function GET() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Rows come back sorted date asc from Convex; group per slug in JS.
  const { rows } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId, viewUserId: viewUserId ?? authUserId, slugs: KEY_SLUGS,
  });

  const out: Record<string, { date: number; value: number }[]> = {};
  for (const slug of KEY_SLUGS) out[slug] = [];
  for (const r of rows) {
    out[r.slug] = out[r.slug] ?? [];
    out[r.slug].push({ date: r.date, value: r.value });
  }
  return NextResponse.json({ series: out });
}

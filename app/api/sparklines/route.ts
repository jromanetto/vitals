import { NextResponse } from "next/server";
import { effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

const KEY_SLUGS = ["ldl", "hba1c", "ferritine", "vitamine-d-25-oh", "crp-ultrasensible-hscrp", "tsh", "testosterone-totale", "homocysteine"];

export async function GET() {
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const out: Record<string, { date: number; value: number }[]> = {};
  for (const slug of KEY_SLUGS) {
    out[slug] = sqlite.prepare(`SELECT date, value FROM biomarker WHERE slug = ? AND user_id = ? ORDER BY date ASC`).all(slug, userId) as Array<{ date: number; value: number }>;
  }
  return NextResponse.json({ series: out });
}

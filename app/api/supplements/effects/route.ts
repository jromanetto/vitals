import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

type Effect = {
  supplementId: number;
  supplement: string;
  startedAt: number;
  targetBiomarker: string;
  biomarkerName: string;
  before: { value: number; date: number; unit: string | null } | null;
  after: { value: number; date: number; unit: string | null } | null;
  changeAbs: number | null;
  changePct: number | null;
  direction: "improving" | "worsening" | "flat" | "unknown";
};

// Lower-is-better for these biomarkers
const LOWER_BETTER = new Set(["ldl", "non-hdl", "triglycerides", "cholesterol-total", "hba1c", "glycemie", "homa-ir", "insuline", "homocysteine", "crp", "crp-ultrasensible-hscrp", "fibrinogene", "ggt", "alat-gpt", "asat-got", "ferritine"]);

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;

  // Each supplement with a targetBiomarker
  const sups = sqlite.prepare(`SELECT id, name, started_at as startedAt, target_biomarker as targetBiomarker FROM supplement WHERE target_biomarker IS NOT NULL AND target_biomarker != ''`).all() as Array<{ id: number; name: string; startedAt: number | null; targetBiomarker: string }>;

  const out: Effect[] = [];
  for (const sup of sups) {
    if (!sup.startedAt) continue;
    const startedAt = sup.startedAt;
    const before = sqlite.prepare(`SELECT name, value, unit, date FROM biomarker WHERE slug = ? AND date < ? ORDER BY date DESC LIMIT 1`).get(sup.targetBiomarker, startedAt) as { name: string; value: number; unit: string | null; date: number } | undefined;
    const after = sqlite.prepare(`SELECT name, value, unit, date FROM biomarker WHERE slug = ? AND date >= ? ORDER BY date ASC LIMIT 1`).get(sup.targetBiomarker, startedAt) as { name: string; value: number; unit: string | null; date: number } | undefined;

    let changeAbs: number | null = null, changePct: number | null = null;
    let direction: Effect["direction"] = "unknown";
    let biomarkerName = before?.name ?? after?.name ?? sup.targetBiomarker;

    if (before && after) {
      changeAbs = after.value - before.value;
      changePct = (changeAbs / before.value) * 100;
      const lowerBetter = LOWER_BETTER.has(sup.targetBiomarker);
      if (Math.abs(changePct) < 3) direction = "flat";
      else direction = (changeAbs > 0) ? (lowerBetter ? "worsening" : "improving") : (lowerBetter ? "improving" : "worsening");
    }

    out.push({
      supplementId: sup.id, supplement: sup.name, startedAt,
      targetBiomarker: sup.targetBiomarker, biomarkerName,
      before: before ? { value: before.value, date: before.date, unit: before.unit } : null,
      after: after ? { value: after.value, date: after.date, unit: after.unit } : null,
      changeAbs, changePct, direction,
    });
  }
  return NextResponse.json({ effects: out });
}

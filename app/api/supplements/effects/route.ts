import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

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
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const readViewUserId = viewUserId ?? authUserId;

  const [supRes, bioRes] = await Promise.all([
    convexServer().query(api.supplements.list, {
      secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
    }),
    convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
    }),
  ]);

  // Each supplement with a targetBiomarker (legacy: target_biomarker not null / not '').
  const sups = supRes.rows
    .map((r) => ({
      id: r.id as number,
      name: (r.name as string) ?? "",
      startedAt: (r.startedAt as number | null) ?? null,
      targetBiomarker: (r.targetBiomarker as string | null) ?? "",
    }))
    .filter((s) => s.targetBiomarker !== "");

  // biomarker rows come back sorted by date ascending (api.biomarkers.all).
  const bioRows = bioRes.rows;

  const out: Effect[] = [];
  for (const sup of sups) {
    if (!sup.startedAt) continue;
    const startedAt = sup.startedAt;
    const forSlug = bioRows.filter((b) => b.slug === sup.targetBiomarker);
    // before: latest measurement strictly before startedAt (date < startedAt, DESC LIMIT 1)
    const beforeCandidates = forSlug.filter((b) => b.date < startedAt);
    const before = beforeCandidates.length ? beforeCandidates[beforeCandidates.length - 1] : undefined;
    // after: earliest measurement on/after startedAt (date >= startedAt, ASC LIMIT 1)
    const after = forSlug.find((b) => b.date >= startedAt);

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

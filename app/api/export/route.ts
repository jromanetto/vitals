import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Health tables (biomarker, dna_insight, symptom_log, habit_log, supplement,
// supplement_log, wearable_metric, note) live in Convex now — read them there.
// The Convex list fns cap symptom/habit/wearable at 365 days; pass the max.
const MAX_DAYS = 3650;

/**
 * Returns a JSON snapshot of all user data for the currently authenticated user.
 * Includes everything except auth.json (security) and PDFs (size).
 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convex = convexServer();
  const secret = bridgeSecret();
  const scope = { secret, authUserId: userId, viewUserId: userId };

  const { data: profileData } = await convex.query(api.profile.get, scope);

  // biomarker: SELECT ... ORDER BY date DESC (snake_case JSON contract)
  const { rows: bmRows } = await convex.query(api.biomarkers.all, scope);
  const biomarkers = bmRows
    .map((r) => ({
      name: r.name, slug: r.slug, category: r.category, value: r.value, unit: r.unit,
      ref_low: r.refLow, ref_high: r.refHigh, date: r.date, source: r.source,
    }))
    .sort((a, b) => b.date - a.date);

  // dna_insight: ORDER BY category, trait
  const { rows: dnaRows } = await convex.query(api.dna.insights, scope);
  const dnaInsights = dnaRows
    .map((r) => ({
      rsid: r.rsid, category: r.category, trait: r.trait,
      user_genotype: r.userGenotype, has_risk: r.hasRisk, summary: r.summary,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.trait.localeCompare(b.trait));

  // supplement: ORDER BY name
  const { rows: supRows } = await convex.query(api.supplements.list, scope);
  const supplements = supRows
    .map((r) => ({
      name: r.name, dose: r.dose, unit: r.unit, timing: r.timing, frequency: r.frequency,
      started_at: r.startedAt, ended_at: r.endedAt, notes: r.notes,
    }))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

  // symptom_log / habit_log / wearable_metric: date DESC (capped 365d server-side)
  const { rows: symRows } = await convex.query(api.symptoms.list, { ...scope, days: MAX_DAYS });
  const symptomLogs = symRows.map((r) => ({ date: r.date, key: r.key, value: r.value, notes: r.notes }));

  const { rows: habRows } = await convex.query(api.habits.list, { ...scope, days: MAX_DAYS });
  const habitLogs = habRows.map((r) => ({ date: r.date, key: r.key }));

  const { rows: wearRows } = await convex.query(api.wearables.overview, { ...scope, days: MAX_DAYS });
  const wearables = wearRows.map((r) => ({ date: r.date, source: r.source, kind: r.kind, value: r.value, unit: r.unit }));

  // note: created_at DESC (note.list caps at 200 rows server-side)
  const { rows: noteRows } = await convex.query(api.notes.list, scope);
  const notes = noteRows.map((r) => ({
    target_type: r.targetType, target_id: r.targetId, body: r.body, tags: r.tags, created_at: r.createdAt,
  }));

  const { rows: reportRows } = await convex.query(api.reports.list, scope);
  const reports = reportRows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, created_at: r.createdAt }));

  const exportObj = {
    exportedAt: new Date().toISOString(),
    appVersion: "vitals-1.0",
    profile: profileData ? JSON.parse(profileData) : {},
    biomarkers, dnaInsights, supplements,
    symptomLogs, habitLogs, wearables, notes, reports,
    counts: {
      biomarkers: biomarkers.length,
      dnaInsights: dnaInsights.length,
      supplements: supplements.length,
      symptomLogs: symptomLogs.length,
      habitLogs: habitLogs.length,
      wearables: wearables.length,
      notes: notes.length,
      reports: reports.length,
    },
  };

  logAudit("export_data", `${biomarkers.length}bm/${dnaInsights.length}dna/${reports.length}rpt`, req);

  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return new NextResponse(JSON.stringify(exportObj, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vitals-export-${stamp}.json"`,
    },
  });
}

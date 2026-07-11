import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Returns a JSON snapshot of all user data for the currently authenticated user.
 * Includes everything except auth.json (security) and PDFs (size).
 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = (db() as any).$client;

  const { data: profileData } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const biomarkers = sqlite.prepare(`SELECT name, slug, category, value, unit, ref_low, ref_high, date, source FROM biomarker WHERE user_id = ? ORDER BY date DESC`).all(userId);
  const dnaInsights = sqlite.prepare(`SELECT rsid, category, trait, user_genotype, has_risk, summary FROM dna_insight WHERE user_id = ? ORDER BY category, trait`).all(userId);
  const supplements = sqlite.prepare(`SELECT name, dose, unit, timing, frequency, started_at, ended_at, notes FROM supplement WHERE user_id = ? ORDER BY name`).all(userId);
  const symptomLogs = sqlite.prepare(`SELECT date, key, value, notes FROM symptom_log WHERE user_id = ? ORDER BY date DESC LIMIT 1000`).all(userId);
  const habitLogs = sqlite.prepare(`SELECT date, key FROM habit_log WHERE user_id = ? ORDER BY date DESC LIMIT 1000`).all(userId);
  const wearables = sqlite.prepare(`SELECT date, source, kind, value, unit FROM wearable_metric WHERE user_id = ? ORDER BY date DESC LIMIT 5000`).all(userId);
  const notes = sqlite.prepare(`SELECT target_type, target_id, body, tags, created_at FROM note WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
  const reports = sqlite.prepare(`SELECT id, kind, title, body, created_at FROM report WHERE user_id = ? ORDER BY created_at DESC`).all(userId);

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

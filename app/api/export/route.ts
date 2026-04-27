import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Returns a JSON snapshot of all user data.
 * Includes everything except auth.json (security) and PDFs (size).
 */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;

  const profile = sqlite.prepare(`SELECT data, updated_at FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string; updated_at: number } | undefined;
  const biomarkers = sqlite.prepare(`SELECT name, slug, category, value, unit, ref_low, ref_high, date, source FROM biomarker ORDER BY date DESC`).all();
  const dnaInsights = sqlite.prepare(`SELECT rsid, category, trait, user_genotype, has_risk, summary FROM dna_insight ORDER BY category, trait`).all();
  const supplements = sqlite.prepare(`SELECT name, dose, unit, timing, frequency, started_at, ended_at, notes FROM supplement ORDER BY name`).all();
  const symptomLogs = sqlite.prepare(`SELECT date, key, value, notes FROM symptom_log ORDER BY date DESC LIMIT 1000`).all();
  const habitLogs = sqlite.prepare(`SELECT date, key FROM habit_log ORDER BY date DESC LIMIT 1000`).all();
  const wearables = sqlite.prepare(`SELECT date, source, kind, value, unit FROM wearable_metric ORDER BY date DESC LIMIT 5000`).all();
  const notes = sqlite.prepare(`SELECT target_type, target_id, body, tags, created_at FROM note ORDER BY created_at DESC`).all();
  const reports = sqlite.prepare(`SELECT id, kind, title, body, created_at FROM report ORDER BY created_at DESC`).all();

  const exportObj = {
    exportedAt: new Date().toISOString(),
    appVersion: "vitals-1.0",
    profile: profile ? JSON.parse(profile.data) : {},
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

  // Return as downloadable JSON
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return new NextResponse(JSON.stringify(exportObj, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vitals-export-${stamp}.json"`,
    },
  });
}

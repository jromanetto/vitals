import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { spearman, spearmanP, pairDated, type DatedValue } from "@/lib/scoring/correlations";

export const runtime = "nodejs";

type Hit = {
  symptomKey: string;
  vsKey: string;
  vsKind: "biomarker" | "supplement" | "habit" | "symptom" | "wearable";
  rho: number;
  p: number;
  n: number;
  direction: "positive" | "negative";
};

const SYMPTOM_LABELS: Record<string, string> = {
  energy: "Énergie", mood: "Humeur", focus: "Focus", sleep_quality: "Sommeil",
  gut: "Digestion", skin: "Peau", anxiety: "Anxiété", libido: "Libido", hrv: "HRV",
};
const HABIT_LABELS: Record<string, string> = {
  sleep_7h: "Sommeil 7h+", water_2L: "Hydratation 2L+", training: "Sport",
  fasting_14h: "Jeûne 14h+", sun: "Soleil matin", meditation: "Méditation", cold_exposure: "Froid",
};
const WEARABLE_LABELS: Record<string, string> = {
  hrv: "HRV", rhr: "FC repos", sleep_total_min: "Sommeil total",
  sleep_deep_min: "Sommeil profond", sleep_rem_min: "Sommeil REM",
  readiness: "Readiness", recovery: "Récupération", sleep_score: "Score sommeil",
  strain: "Strain", steps: "Pas", respiratory_rate: "Resp.", spo2: "SpO₂",
};

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  // Ensure wearable_metric exists for old DBs
  sqlite.exec(`CREATE TABLE IF NOT EXISTS wearable_metric (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT, UNIQUE(date, source, kind))`);

  const symptomLogs = sqlite.prepare(`SELECT date, key, value FROM symptom_log WHERE user_id = ?`).all(userId) as Array<{ date: string; key: string; value: number }>;
  const symptomsByKey: Record<string, DatedValue[]> = {};
  for (const l of symptomLogs) (symptomsByKey[l.key] ??= []).push({ date: l.date, value: l.value });

  const habitLogs = sqlite.prepare(`SELECT date, key FROM habit_log WHERE user_id = ?`).all(userId) as Array<{ date: string; key: string }>;
  const habitsByKey: Record<string, DatedValue[]> = {};
  for (const l of habitLogs) (habitsByKey[l.key] ??= []).push({ date: l.date, value: 1 });

  // supplement_log has no direct user_id; scope via the parent supplement table.
  const supLogs = sqlite.prepare(`SELECT s.name, sl.date FROM supplement_log sl JOIN supplement s ON s.id = sl.supplement_id WHERE sl.taken = 1 AND s.user_id = ?`).all(userId) as Array<{ name: string; date: string }>;
  const supplementsByName: Record<string, DatedValue[]> = {};
  for (const l of supLogs) (supplementsByName[l.name] ??= []).push({ date: l.date, value: 1 });

  const bmRows = sqlite.prepare(`SELECT slug, name, date, value FROM biomarker WHERE user_id = ? ORDER BY date`).all(userId) as Array<{ slug: string; name: string; date: number; value: number }>;
  const bmsBySlug: Record<string, { name: string; values: DatedValue[] }> = {};
  for (const r of bmRows) {
    if (!bmsBySlug[r.slug]) bmsBySlug[r.slug] = { name: r.name, values: [] };
    bmsBySlug[r.slug].values.push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });
  }

  const wearableRows = sqlite.prepare(`SELECT date, kind, value FROM wearable_metric WHERE user_id = ? ORDER BY date`).all(userId) as Array<{ date: string; kind: string; value: number }>;
  const wearablesByKind: Record<string, DatedValue[]> = {};
  for (const r of wearableRows) (wearablesByKind[r.kind] ??= []).push({ date: r.date, value: r.value });

  const out: Hit[] = [];

  for (const [symKey, symValues] of Object.entries(symptomsByKey)) {
    if (symValues.length < 5) continue;

    // Symptom × biomarker
    for (const [slug, bm] of Object.entries(bmsBySlug)) {
      if (bm.values.length < 3) continue;
      const { x, y } = pairDated(symValues, bm.values, 14);
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.4) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: slug, vsKind: "biomarker", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }

    // Symptom × habit
    for (const [habitKey, habitDates] of Object.entries(habitsByKey)) {
      if (habitDates.length < 5) continue;
      const habitSet = new Set(habitDates.map((h) => h.date));
      const x: number[] = [], y: number[] = [];
      for (const sv of symValues) { x.push(sv.value); y.push(habitSet.has(sv.date) ? 1 : 0); }
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.3) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: habitKey, vsKind: "habit", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }

    // Symptom × supplement
    for (const [supName, supDates] of Object.entries(supplementsByName)) {
      if (supDates.length < 5) continue;
      const supSet = new Set(supDates.map((h) => h.date));
      const x: number[] = [], y: number[] = [];
      for (const sv of symValues) { x.push(sv.value); y.push(supSet.has(sv.date) ? 1 : 0); }
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.3) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: supName, vsKind: "supplement", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }

    // NEW: Symptom × wearable (same-day continuous)
    for (const [wKind, wValues] of Object.entries(wearablesByKind)) {
      if (wValues.length < 5) continue;
      const { x, y } = pairDated(symValues, wValues, 1);
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.3) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: wKind, vsKind: "wearable", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }
  }

  // NEW: wearable × biomarker (using wearable kind as "symptomKey" pseudo)
  for (const [wKind, wValues] of Object.entries(wearablesByKind)) {
    if (wValues.length < 5) continue;
    for (const [slug, bm] of Object.entries(bmsBySlug)) {
      if (bm.values.length < 3) continue;
      const { x, y } = pairDated(wValues, bm.values, 14);
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.4) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: `wearable:${wKind}`, vsKey: slug, vsKind: "biomarker", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }
  }

  // Symptom × symptom
  const symKeys = Object.keys(symptomsByKey);
  for (let i = 0; i < symKeys.length; i++) {
    for (let j = i + 1; j < symKeys.length; j++) {
      const a = symptomsByKey[symKeys[i]], b = symptomsByKey[symKeys[j]];
      if (a.length < 5 || b.length < 5) continue;
      const { x, y } = pairDated(a, b, 0);
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.5) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.05) continue;
      out.push({ symptomKey: symKeys[i], vsKey: symKeys[j], vsKind: "symptom", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }
  }

  out.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  return NextResponse.json({
    correlations: out.slice(0, 60),
    labels: { symptoms: SYMPTOM_LABELS, habits: HABIT_LABELS, wearables: WEARABLE_LABELS },
    biomarkerNames: Object.fromEntries(Object.entries(bmsBySlug).map(([k, v]) => [k, v.name])),
    counts: {
      symptoms: Object.values(symptomsByKey).reduce((s, v) => s + v.length, 0),
      habits: habitLogs.length, supplements: supLogs.length, wearables: wearableRows.length,
    },
  });
}

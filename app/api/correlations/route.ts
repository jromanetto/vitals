import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { spearman, spearmanP, pairDated, type DatedValue } from "@/lib/scoring/correlations";

export const runtime = "nodejs";

type Hit = {
  symptomKey: string;
  vsKey: string;
  vsKind: "biomarker" | "supplement" | "habit" | "symptom";
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

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;

  const symptomLogs = sqlite.prepare(`SELECT date, key, value FROM symptom_log`).all() as Array<{ date: string; key: string; value: number }>;
  if (symptomLogs.length === 0) return NextResponse.json({ correlations: [], note: "Aucun log de symptômes — fais des entrées quelques jours pour voir les corrélations." });

  // Group symptoms by key
  const symptomsByKey: Record<string, DatedValue[]> = {};
  for (const l of symptomLogs) {
    (symptomsByKey[l.key] ??= []).push({ date: l.date, value: l.value });
  }

  // Habit logs
  const habitLogs = sqlite.prepare(`SELECT date, key FROM habit_log`).all() as Array<{ date: string; key: string }>;
  const habitsByKey: Record<string, DatedValue[]> = {};
  for (const l of habitLogs) {
    (habitsByKey[l.key] ??= []).push({ date: l.date, value: 1 });
  }

  // Supplement adherence (count taken per day per supplement)
  const supLogs = sqlite.prepare(`SELECT s.name, sl.date FROM supplement_log sl JOIN supplement s ON s.id = sl.supplement_id WHERE sl.taken = 1`).all() as Array<{ name: string; date: string }>;
  const supplementsByName: Record<string, DatedValue[]> = {};
  for (const l of supLogs) {
    (supplementsByName[l.name] ??= []).push({ date: l.date, value: 1 });
  }

  // Latest biomarker timeseries (need >= 5 measurements to be meaningful for rank correlation)
  const bmRows = sqlite.prepare(`SELECT slug, name, date, value FROM biomarker ORDER BY date`).all() as Array<{ slug: string; name: string; date: number; value: number }>;
  const bmsBySlug: Record<string, { name: string; values: DatedValue[] }> = {};
  for (const r of bmRows) {
    if (!bmsBySlug[r.slug]) bmsBySlug[r.slug] = { name: r.name, values: [] };
    bmsBySlug[r.slug].values.push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });
  }

  const out: Hit[] = [];

  for (const [symKey, symValues] of Object.entries(symptomsByKey)) {
    if (symValues.length < 5) continue;

    // Symptom × biomarker (need >= 5 paired points; usually too sparse for biomarkers given they're rare lab tests)
    for (const [slug, bm] of Object.entries(bmsBySlug)) {
      if (bm.values.length < 3) continue;
      const { x, y } = pairDated(symValues, bm.values, 14); // ±14 days for biomarker matching
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.4) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: slug, vsKind: "biomarker", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }

    // Symptom × habit (binary 0/1)
    for (const [habitKey, habitDates] of Object.entries(habitsByKey)) {
      if (habitDates.length < 5) continue;
      // For each symptom date, look if habit was done that day → 1, else 0
      const habitSet = new Set(habitDates.map((h) => h.date));
      const x: number[] = [], y: number[] = [];
      for (const s of symValues) {
        x.push(s.value);
        y.push(habitSet.has(s.date) ? 1 : 0);
      }
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.3) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: habitKey, vsKind: "habit", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }

    // Symptom × supplement adherence
    for (const [supName, supDates] of Object.entries(supplementsByName)) {
      if (supDates.length < 5) continue;
      const supSet = new Set(supDates.map((h) => h.date));
      const x: number[] = [], y: number[] = [];
      for (const s of symValues) {
        x.push(s.value);
        y.push(supSet.has(s.date) ? 1 : 0);
      }
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.3) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ symptomKey: symKey, vsKey: supName, vsKind: "supplement", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }
  }

  // Symptom × symptom (find which symptoms move together)
  const symKeys = Object.keys(symptomsByKey);
  for (let i = 0; i < symKeys.length; i++) {
    for (let j = i + 1; j < symKeys.length; j++) {
      const a = symptomsByKey[symKeys[i]], b = symptomsByKey[symKeys[j]];
      if (a.length < 5 || b.length < 5) continue;
      const { x, y } = pairDated(a, b, 0); // same-day only
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.5) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.05) continue;
      out.push({ symptomKey: symKeys[i], vsKey: symKeys[j], vsKind: "symptom", rho, p, n: x.length, direction: rho > 0 ? "positive" : "negative" });
    }
  }

  // Sort by |rho| descending
  out.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  return NextResponse.json({
    correlations: out.slice(0, 50),
    labels: { symptoms: SYMPTOM_LABELS, habits: HABIT_LABELS },
    biomarkerNames: Object.fromEntries(Object.entries(bmsBySlug).map(([k, v]) => [k, v.name])),
  });
}

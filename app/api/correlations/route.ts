import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const readViewUserId = viewUserId ?? authUserId;

  // All data sources now come from Convex (isolation resolved server-side via
  // active-link-only). The Convex read fns are date-windowed (max 365d); pass
  // days=365 to fetch the widest available history for the correlation math.
  const convex = convexServer();
  const secret = bridgeSecret();
  const [symptomsRes, habitsRes, suppRes, suppLogRes, bioRes, wearRes] = await Promise.all([
    convex.query(api.symptoms.list, { secret, authUserId, viewUserId: readViewUserId, days: 365 }),
    convex.query(api.habits.list, { secret, authUserId, viewUserId: readViewUserId, days: 365 }),
    convex.query(api.supplements.list, { secret, authUserId, viewUserId: readViewUserId }),
    convex.query(api.supplements.logHistory, { secret, authUserId, viewUserId: readViewUserId, days: 365 }),
    convex.query(api.biomarkers.all, { secret, authUserId, viewUserId: readViewUserId }),
    convex.query(api.wearables.overview, { secret, authUserId, viewUserId: readViewUserId, days: 365 }),
  ]);

  const symptomLogs = symptomsRes.rows as Array<{ date: string; key: string; value: number }>;
  const symptomsByKey: Record<string, DatedValue[]> = {};
  for (const l of symptomLogs) (symptomsByKey[l.key] ??= []).push({ date: l.date, value: l.value });

  const habitLogs = habitsRes.rows as Array<{ date: string; key: string }>;
  const habitsByKey: Record<string, DatedValue[]> = {};
  for (const l of habitLogs) (habitsByKey[l.key] ??= []).push({ date: l.date, value: 1 });

  // Rebuild the legacy JOIN (supplement_log taken=1 × supplement.name) from two
  // Convex reads: logHistory gives {supplementId, date} for taken rows; list maps
  // supplement legacyId → name.
  const supNameById = new Map<number, string>();
  for (const s of suppRes.rows as Array<{ id: number; name: string }>) supNameById.set(s.id, s.name);
  const supLogs = (suppLogRes.rows as Array<{ supplementId: number; date: string }>)
    .map((l) => ({ name: supNameById.get(l.supplementId), date: l.date }))
    .filter((l): l is { name: string; date: string } => !!l.name);
  const supplementsByName: Record<string, DatedValue[]> = {};
  for (const l of supLogs) (supplementsByName[l.name] ??= []).push({ date: l.date, value: 1 });

  // biomarkers.all is already sorted by date ASC; date is numeric epoch (ms).
  const bmRows = bioRes.rows as Array<{ slug: string; name: string; date: number; value: number }>;
  const bmsBySlug: Record<string, { name: string; values: DatedValue[] }> = {};
  for (const r of bmRows) {
    if (!bmsBySlug[r.slug]) bmsBySlug[r.slug] = { name: r.name, values: [] };
    bmsBySlug[r.slug].values.push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });
  }

  const wearableRows = wearRes.rows as Array<{ date: string; kind: string; value: number }>;
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

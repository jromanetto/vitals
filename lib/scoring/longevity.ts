/**
 * Vitals Longevity Score 0-100.
 * Inputs:
 *   - 40% biomarkers in optimal range (per biomarker_meta or fallback to lab range).
 *   - 25% DNA: longevity-favorable variants minus risk variants, normalized.
 *   - 20% lifestyle (profile.activityLevel, sleepHours, stressLevel, dietType, smoker, alcohol).
 *   - 15% trends (5-year direction of LDL, HOMA, CRP, ferritine, TSH, vit D).
 */
import { db } from "@/lib/db";
import { decryptProfile } from "@/lib/crypto-fields";

export type CompletenessSource = {
  key: "biomarkers" | "profile" | "dna" | "wearables";
  label: string;
  done: boolean;
  href: string;
  cta: string;
  weightPct: number; // share of the score this source drives (0 for non-scoring sources)
};

export type ScoreBreakdown = {
  total: number;            // confidence-weighted over measured axes only (0-100)
  biomarkers: number;       // 0-40
  dna: number;              // 0-25
  lifestyle: number;        // 0-20
  trends: number;           // 0-15
  // Which axes actually have data. The total is computed ONLY from measured
  // axes (rescaled), so a near-empty account is never punished with a low grade.
  measured: { biomarkers: boolean; dna: boolean; lifestyle: boolean; trends: boolean };
  completeness: {
    doneCount: number;
    totalCount: number;
    scorable: boolean;      // at least one score axis has data
    sources: CompletenessSource[];
  };
  details: {
    biomarkersInRange: number;
    biomarkersTotal: number;
    dnaFavorable: number;
    dnaRisk: number;
    lifestylePoints: { label: string; ok: boolean }[];
    trendsImproving: number;
    trendsWorsening: number;
  };
};

export function computeLongevityScore(userId: number): ScoreBreakdown {
  const sqlite = db().$client;

  // ---------- 1. Biomarkers (40%) ----------
  const latestBms = sqlite.prepare(`
    SELECT b.slug, b.name, b.value, b.ref_low, b.ref_high
    FROM biomarker b
    JOIN (SELECT slug, MAX(date) AS md FROM biomarker WHERE user_id = ? GROUP BY slug) x
    ON x.slug = b.slug AND x.md = b.date
    WHERE b.user_id = ?
  `).all(userId, userId) as Array<{ slug: string; name: string; value: number; ref_low: number | null; ref_high: number | null }>;

  let inRange = 0;
  let evaluable = 0;
  for (const b of latestBms) {
    if (b.ref_low == null || b.ref_high == null) continue;
    evaluable++;
    if (b.value >= b.ref_low && b.value <= b.ref_high) inRange++;
  }
  const bmMeasured = evaluable > 0;
  const bmScore = bmMeasured ? (inRange / evaluable) * 40 : 0;

  // ---------- 2. DNA (25%) ----------
  const dna = sqlite.prepare(`
    SELECT category, has_risk, magnitude FROM dna_insight WHERE user_id = ? AND has_risk IS NOT NULL
  `).all(userId) as Array<{ category: string; has_risk: number; magnitude: number | null }>;

  let dnaFavorable = 0;
  let dnaRisk = 0;
  let dnaWeightedSum = 0;
  let dnaWeightTotal = 0;
  for (const d of dna) {
    const mag = d.magnitude ?? 1;
    dnaWeightTotal += mag;
    if (d.has_risk === 1) {
      dnaRisk++;
      dnaWeightedSum -= mag;
    } else {
      dnaFavorable++;
      dnaWeightedSum += mag;
    }
  }
  const dnaMeasured = dna.length > 0;
  // Map [-totalMagnitude .. +totalMagnitude] to [0..25]
  const dnaScore = dnaMeasured && dnaWeightTotal > 0
    ? Math.max(0, Math.min(25, 12.5 + (dnaWeightedSum / dnaWeightTotal) * 12.5))
    : 0;

  // ---------- 3. Lifestyle (20%) ----------
  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const profile: Record<string, unknown> = profileRow ? decryptProfile(JSON.parse(profileRow.data)) : {};

  const lifestyleChecks: { label: string; ok: boolean; weight: number }[] = [
    { label: "Activité ≥ modérée", weight: 4, ok: ["Modéré (3-4x/sem)", "Intense (5-6x/sem)", "Athlète"].includes(String(profile.activityLevel ?? "")) },
    { label: "Sommeil ≥ 7h", weight: 3, ok: typeof profile.sleepHours === "number" && profile.sleepHours >= 7 },
    { label: "Non-fumeur", weight: 4, ok: ["Non", "Ex-fumeur"].includes(String(profile.smoker ?? "")) },
    { label: "Alcool ≤ 7 verres/sem", weight: 3, ok: typeof profile.alcoholDrinksWeek === "number" ? profile.alcoholDrinksWeek <= 7 : (profile.alcoholDrinksWeek === undefined ? false : true) },
    { label: "Stress ≤ 6/10", weight: 2, ok: typeof profile.stressLevel === "number" && profile.stressLevel <= 6 },
    { label: "Régime sain", weight: 2, ok: ["Méditerranéen", "Flexitarien", "Pescetarien", "Végétarien", "Vegan", "Paléo"].includes(String(profile.dietType ?? "")) },
    { label: "Méditation régulière", weight: 1, ok: ["Hebdo", "Quotidien"].includes(String(profile.meditation ?? "")) },
    { label: "Hydration ≥ 2L", weight: 1, ok: typeof profile.waterLiters === "number" && profile.waterLiters >= 2 },
  ];
  // Lifestyle is "measured" once the user has filled any relevant profile field
  // — otherwise an empty profile would drag the score to 0/20 (the bug that made
  // a brand-new account look unhealthy). Unmeasured → excluded from the total.
  const LIFESTYLE_KEYS = ["activityLevel", "sleepHours", "smoker", "alcoholDrinksWeek", "stressLevel", "dietType", "meditation", "waterLiters"];
  const lifestyleMeasured = LIFESTYLE_KEYS.some((k) => {
    const v = profile[k];
    return v !== undefined && v !== null && v !== "";
  });
  const lifeMaxWeight = lifestyleChecks.reduce((s, c) => s + c.weight, 0);
  const lifeWeight = lifestyleChecks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const lifestyleScore = lifestyleMeasured ? (lifeWeight / lifeMaxWeight) * 20 : 0;

  // ---------- 4. Trends (15%) ----------
  const TREND_BIOMARKERS = ["ldl", "homa-ir", "crp", "ferritine", "tsh", "vitamine-d-25-oh", "hba1c"];
  let trendsImproving = 0;
  let trendsWorsening = 0;
  const trendDirections: Record<string, "lower-better" | "higher-better" | "neutral"> = {
    "ldl": "lower-better", "homa-ir": "lower-better", "crp": "lower-better",
    "ferritine": "neutral", "tsh": "neutral", "vitamine-d-25-oh": "higher-better",
    "hba1c": "lower-better",
  };
  let trendsEvaluable = 0; // trend biomarkers with ≥2 data points (i.e. a measurable trend)
  for (const slug of TREND_BIOMARKERS) {
    const points = sqlite.prepare(`SELECT value, date FROM biomarker WHERE slug = ? AND user_id = ? ORDER BY date ASC`).all(slug, userId) as Array<{ value: number; date: number }>;
    if (points.length < 2) continue;
    trendsEvaluable++;
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const direction = trendDirections[slug];
    if (direction === "lower-better") {
      if (last < first * 0.95) trendsImproving++;
      else if (last > first * 1.10) trendsWorsening++;
    } else if (direction === "higher-better") {
      if (last > first * 1.10) trendsImproving++;
      else if (last < first * 0.90) trendsWorsening++;
    }
  }
  const trendsMeasured = trendsEvaluable > 0;
  const moves = trendsImproving + trendsWorsening;
  // Measured but flat (data exists, no strong move) → neutral half, not 0.
  const trendsScore = !trendsMeasured ? 0 : moves > 0 ? (trendsImproving / moves) * 15 : 7.5;

  // ---------- Wearables (not a score axis, but a completion source) ----------
  let wearablesMeasured = false;
  try {
    wearablesMeasured = Boolean(sqlite.prepare(`SELECT 1 FROM wearable_metric WHERE user_id = ? LIMIT 1`).get(userId));
  } catch { /* table may not exist yet */ }

  // ---------- Confidence-weighted total ----------
  // Only axes that actually have data contribute, rescaled to 0-100. A new
  // account with one good blood panel scores on that panel — it is never
  // dragged down to a discouraging grade by the data it hasn't provided yet.
  const axes = [
    { score: bmScore, max: 40, measured: bmMeasured },
    { score: dnaScore, max: 25, measured: dnaMeasured },
    { score: lifestyleScore, max: 20, measured: lifestyleMeasured },
    { score: trendsScore, max: 15, measured: trendsMeasured },
  ];
  const maxMeasured = axes.reduce((s, a) => s + (a.measured ? a.max : 0), 0);
  const sumMeasured = axes.reduce((s, a) => s + (a.measured ? a.score : 0), 0);
  const total = maxMeasured > 0 ? Math.round((sumMeasured / maxMeasured) * 100) : 0;

  const sources: CompletenessSource[] = [
    { key: "biomarkers", label: "Bilan sanguin", done: bmMeasured, href: "/import", cta: "Importer", weightPct: 40 },
    { key: "dna", label: "ADN 23andMe", done: dnaMeasured, href: "/import", cta: "Importer", weightPct: 25 },
    { key: "profile", label: "Profil santé", done: lifestyleMeasured, href: "/profile", cta: "Compléter", weightPct: 20 },
    { key: "wearables", label: "Wearables (Whoop/Oura)", done: wearablesMeasured, href: "/import", cta: "Connecter", weightPct: 0 },
  ];

  return {
    total,
    biomarkers: Math.round(bmScore * 10) / 10,
    dna: Math.round(dnaScore * 10) / 10,
    lifestyle: Math.round(lifestyleScore * 10) / 10,
    trends: Math.round(trendsScore * 10) / 10,
    measured: { biomarkers: bmMeasured, dna: dnaMeasured, lifestyle: lifestyleMeasured, trends: trendsMeasured },
    completeness: {
      doneCount: sources.filter((s) => s.done).length,
      totalCount: sources.length,
      scorable: maxMeasured > 0,
      sources,
    },
    details: {
      biomarkersInRange: inRange,
      biomarkersTotal: evaluable,
      dnaFavorable, dnaRisk,
      lifestylePoints: lifestyleChecks.map((c) => ({ label: c.label, ok: c.ok })),
      trendsImproving, trendsWorsening,
    },
  };
}

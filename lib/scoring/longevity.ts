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

export type ScoreBreakdown = {
  total: number;
  biomarkers: number;       // 0-40
  dna: number;              // 0-25
  lifestyle: number;        // 0-20
  trends: number;           // 0-15
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

export function computeLongevityScore(): ScoreBreakdown {
  const sqlite = db().$client;

  // ---------- 1. Biomarkers (40%) ----------
  const latestBms = sqlite.prepare(`
    SELECT b.slug, b.name, b.value, b.ref_low, b.ref_high
    FROM biomarker b
    JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x
    ON x.slug = b.slug AND x.md = b.date
  `).all() as Array<{ slug: string; name: string; value: number; ref_low: number | null; ref_high: number | null }>;

  let inRange = 0;
  let evaluable = 0;
  for (const b of latestBms) {
    if (b.ref_low == null || b.ref_high == null) continue;
    evaluable++;
    if (b.value >= b.ref_low && b.value <= b.ref_high) inRange++;
  }
  const bmScore = evaluable > 0 ? (inRange / evaluable) * 40 : 20;

  // ---------- 2. DNA (25%) ----------
  const dna = sqlite.prepare(`
    SELECT category, has_risk, magnitude FROM dna_insight WHERE has_risk IS NOT NULL
  `).all() as Array<{ category: string; has_risk: number; magnitude: number | null }>;

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
  // Map [-totalMagnitude .. +totalMagnitude] to [0..25]
  const dnaScore = dnaWeightTotal > 0
    ? Math.max(0, Math.min(25, 12.5 + (dnaWeightedSum / dnaWeightTotal) * 12.5))
    : 12.5;

  // ---------- 3. Lifestyle (20%) ----------
  const profileRow = sqlite.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string } | undefined;
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
  const lifeMaxWeight = lifestyleChecks.reduce((s, c) => s + c.weight, 0);
  const lifeWeight = lifestyleChecks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const lifestyleScore = (lifeWeight / lifeMaxWeight) * 20;

  // ---------- 4. Trends (15%) ----------
  const TREND_BIOMARKERS = ["ldl", "homa-ir", "crp", "ferritine", "tsh", "vitamine-d-25-oh", "hba1c"];
  let trendsImproving = 0;
  let trendsWorsening = 0;
  const trendDirections: Record<string, "lower-better" | "higher-better" | "neutral"> = {
    "ldl": "lower-better", "homa-ir": "lower-better", "crp": "lower-better",
    "ferritine": "neutral", "tsh": "neutral", "vitamine-d-25-oh": "higher-better",
    "hba1c": "lower-better",
  };
  for (const slug of TREND_BIOMARKERS) {
    const points = sqlite.prepare(`SELECT value, date FROM biomarker WHERE slug = ? ORDER BY date ASC`).all(slug) as Array<{ value: number; date: number }>;
    if (points.length < 2) continue;
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
  const measured = trendsImproving + trendsWorsening;
  const trendsScore = measured > 0
    ? (trendsImproving / measured) * 15
    : 7.5;

  const total = Math.round(bmScore + dnaScore + lifestyleScore + trendsScore);

  return {
    total,
    biomarkers: Math.round(bmScore * 10) / 10,
    dna: Math.round(dnaScore * 10) / 10,
    lifestyle: Math.round(lifestyleScore * 10) / 10,
    trends: Math.round(trendsScore * 10) / 10,
    details: {
      biomarkersInRange: inRange,
      biomarkersTotal: evaluable,
      dnaFavorable, dnaRisk,
      lifestylePoints: lifestyleChecks.map((c) => ({ label: c.label, ok: c.ok })),
      trendsImproving, trendsWorsening,
    },
  };
}

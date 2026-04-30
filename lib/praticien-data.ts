import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { META_BY_SLUG } from "@/lib/biomarker-meta";

export type ProfileData = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  sex?: string;
  bloodType?: string;
};

export type BiomarkerRow = {
  slug: string;
  name: string;
  category: string | null;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  date: number;
};

export type Status = "optimal" | "normal" | "slightly-off" | "attention" | "unknown";

export type EnrichedBiomarker = BiomarkerRow & {
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  status: Status;
};

export type DnaRow = { rsid: string; trait: string; genotype: string; magnitude: number | null; summary: string | null };
export type SupplementRow = { name: string; brand: string | null; dose: string | null; unit: string | null; timing: string | null; frequency: string | null; duration: string | null };
export type SymptomRow = { key: string; avg: number; n: number; last: string };

export type PraticienData = {
  profile: ProfileData;
  panelDate: number | null;
  offRange: EnrichedBiomarker[];
  optimal: EnrichedBiomarker[];
  bloodReport: { synthesis?: string; headline?: string; panelDate: number } | null;
  dnaRisks: DnaRow[];
  dnaProtective: DnaRow[];
  supplements: SupplementRow[];
  symptoms: SymptomRow[];
};

function statusOf(r: {
  value: number;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
}): Status {
  const inLong =
    r.longevityLow != null && r.longevityHigh != null && r.value >= r.longevityLow && r.value <= r.longevityHigh;
  const inLab = r.refLow != null && r.refHigh != null && r.value >= r.refLow && r.value <= r.refHigh;
  const inOpt =
    r.optimalLow != null && r.optimalHigh != null && r.value >= r.optimalLow && r.value <= r.optimalHigh;
  if (inLong) return "optimal";
  if (inLab || inOpt) return "normal";
  const ref =
    r.refLow != null && r.refHigh != null
      ? [r.refLow, r.refHigh]
      : r.optimalLow != null && r.optimalHigh != null
      ? [r.optimalLow, r.optimalHigh]
      : null;
  if (!ref) return "unknown";
  const [lo, hi] = ref;
  const offset =
    r.value < lo ? Math.abs((lo - r.value) / lo) : r.value > hi ? Math.abs((r.value - hi) / hi) : 0;
  return offset <= 0.15 ? "slightly-off" : "attention";
}

export async function loadPraticienData(userId: number): Promise<PraticienData> {
  ensureSchema();
  const sqlite = db().$client;

  const profileRow = sqlite
    .prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
    .get(userId) as { data: string } | undefined;
  let profile: ProfileData = {};
  if (profileRow) {
    try { profile = JSON.parse(profileRow.data); } catch { profile = {}; }
  }

  const latestPanel = sqlite
    .prepare(`SELECT MAX(date) AS d FROM biomarker WHERE user_id = ?`)
    .get(userId) as { d: number | null } | undefined;
  const panelDate = latestPanel?.d ?? null;

  let biomarkers: BiomarkerRow[] = [];
  if (panelDate) {
    biomarkers = sqlite
      .prepare(
        `SELECT slug, name, category, value, unit, ref_low AS refLow, ref_high AS refHigh, date
         FROM biomarker WHERE user_id = ? AND date = ?
         ORDER BY LOWER(name)`
      )
      .all(userId, panelDate) as BiomarkerRow[];
  }

  const enriched: EnrichedBiomarker[] = biomarkers.map((b) => {
    const meta = META_BY_SLUG[b.slug];
    const optimalLow = meta?.optimalLow ?? null;
    const optimalHigh = meta?.optimalHigh ?? null;
    const longevityLow = meta?.longevityLow ?? null;
    const longevityHigh = meta?.longevityHigh ?? null;
    const status = statusOf({
      value: b.value, refLow: b.refLow, refHigh: b.refHigh,
      optimalLow, optimalHigh, longevityLow, longevityHigh,
    });
    return { ...b, optimalLow, optimalHigh, longevityLow, longevityHigh, status };
  });

  const offRange = enriched.filter((b) => b.status === "slightly-off" || b.status === "attention");
  const optimal = enriched.filter((b) => b.status === "optimal" || b.status === "normal");

  let bloodReport: PraticienData["bloodReport"] = null;
  try {
    const row = sqlite
      .prepare(`SELECT panel_date AS panelDate, body FROM blood_report WHERE user_id = ? ORDER BY panel_date DESC LIMIT 1`)
      .get(userId) as { panelDate: number; body: string } | undefined;
    if (row) {
      const parsed = JSON.parse(row.body);
      bloodReport = { synthesis: parsed.synthesis, headline: parsed.headline, panelDate: row.panelDate };
    }
  } catch { bloodReport = null; }

  const dnaRisks = sqlite
    .prepare(
      `SELECT rsid, trait, user_genotype AS genotype, magnitude, summary
       FROM dna_insight WHERE user_id = ? AND has_risk = 1
       ORDER BY COALESCE(magnitude,0) DESC LIMIT 25`
    )
    .all(userId) as DnaRow[];
  const dnaProtective = sqlite
    .prepare(
      `SELECT rsid, trait, user_genotype AS genotype, magnitude, summary
       FROM dna_insight WHERE user_id = ? AND is_protective = 1
       ORDER BY COALESCE(magnitude,0) DESC LIMIT 25`
    )
    .all(userId) as DnaRow[];

  const supplements = sqlite
    .prepare(
      `SELECT name, brand, dose, unit, timing, frequency, duration
       FROM supplement WHERE user_id = ? AND ended_at IS NULL
       ORDER BY LOWER(name)`
    )
    .all(userId) as SupplementRow[];

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);
  const symptoms = sqlite
    .prepare(
      `SELECT key, AVG(value) AS avg, COUNT(*) AS n, MAX(date) AS last
       FROM symptom_log WHERE user_id = ? AND date >= ?
       GROUP BY key ORDER BY avg DESC`
    )
    .all(userId, sinceISO) as SymptomRow[];

  return { profile, panelDate, offRange, optimal, bloodReport, dnaRisks, dnaProtective, supplements, symptoms };
}

export const SYMPTOM_LABELS: Record<string, string> = {
  energy: "Énergie", focus: "Concentration", mood: "Humeur", anxiety: "Anxiété",
  sleep_quality: "Qualité sommeil", gut: "Digestion", libido: "Libido", skin: "Peau",
  hrv: "VFC (HRV)", pain: "Douleur", stress: "Stress",
};

export const STATUS_LABELS: Record<Status, string> = {
  optimal: "Optimal", normal: "Normal",
  "slightly-off": "Légèrement hors plage", attention: "Attention", unknown: "—",
};

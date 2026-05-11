/**
 * Deterministic profile pre-fill. Queries the database for facts the user has
 * already given us (blood panel dates, wearables in use, current supplements,
 * recent symptoms, nutrition preferences) and returns a partial profile patch.
 *
 * No LLM calls — runs in ~50ms. Pure read-only. Caller (the API route) compares
 * against the current profile and presents only the deltas to the user.
 */
import { db } from "@/lib/db";
import type { WearableId, FrequencyBucket, YesNoUnknown } from "@/lib/medical/types";

export type PrefillPatch = Record<string, unknown>;

type WearableSourceMap = { source: string; target: WearableId };

const WEARABLE_SOURCE_MAP: WearableSourceMap[] = [
  { source: "whoop", target: "whoop" },
  { source: "oura", target: "oura" },
  { source: "apple", target: "appleWatch" },
  { source: "apple_health", target: "appleWatch" },
  { source: "applewatch", target: "appleWatch" },
  { source: "garmin", target: "garmin" },
  { source: "fitbit", target: "fitbit" },
  { source: "polar", target: "polar" },
  { source: "withings", target: "withings" },
  { source: "cgm", target: "cgm" },
  { source: "dexcom", target: "cgm" },
  { source: "freestyle", target: "cgm" },
];

function toFrequencyBucket(perWeek: number): FrequencyBucket {
  if (perWeek <= 0) return "never";
  if (perWeek < 1) return "rare";
  if (perWeek < 3) return "sometimes";
  if (perWeek < 6) return "often";
  return "daily";
}

type RawRow = Record<string, unknown>;

function rows<T = RawRow>(sql: string, ...params: unknown[]): T[] {
  const sqlite = db().$client;
  return sqlite.prepare(sql).all(...params) as T[];
}

function one<T = RawRow>(sql: string, ...params: unknown[]): T | undefined {
  const sqlite = db().$client;
  return sqlite.prepare(sql).get(...params) as T | undefined;
}

export function computePrefill(userId: number, current: Record<string, unknown>): {
  patch: PrefillPatch;
  reasons: Record<string, string>;
} {
  const patch: PrefillPatch = {};
  const reasons: Record<string, string> = {};

  // ============================================================
  // 1) Last full blood panel date -> screeningHistory.blood_panel
  // ============================================================
  try {
    const r = one<{ d: number }>(
      `SELECT MAX(date) as d FROM biomarker WHERE user_id = ?`,
      userId,
    );
    if (r?.d) {
      const iso = new Date(r.d).toISOString().slice(0, 10);
      const sh = (current.screeningHistory as Record<string, { lastDate?: string }>) ?? {};
      if (!sh.blood_panel?.lastDate) {
        patch.screeningHistory = { ...sh, blood_panel: { lastDate: iso } };
        reasons.screeningHistory = `Dernier biomarqueur enregistré le ${iso}`;
      }
    }
  } catch {}

  // ============================================================
  // 2) Wearables owned -> distinct sources in wearable_metric
  // ============================================================
  try {
    const sources = rows<{ source: string }>(
      `SELECT DISTINCT source FROM wearable_metric WHERE user_id = ?`,
      userId,
    );
    const owned: WearableId[] = [];
    for (const s of sources) {
      const m = WEARABLE_SOURCE_MAP.find((x) => x.source === s.source.toLowerCase());
      if (m && !owned.includes(m.target)) owned.push(m.target);
    }
    if (owned.length > 0) {
      const cur = (current.wearables as WearableId[] | undefined) ?? [];
      // Union with existing.
      const merged = Array.from(new Set([...cur, ...owned]));
      if (merged.length !== cur.length) {
        patch.wearables = merged;
        reasons.wearables = `Sources détectées : ${owned.join(", ")}`;
      }
    }
  } catch {}

  // ============================================================
  // 3) Resting HR + HRV + sleep average from wearable_metric (60d)
  // ============================================================
  try {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

    const rhrRow = one<{ v: number }>(
      `SELECT AVG(value) as v FROM wearable_metric WHERE user_id = ? AND kind = 'rhr' AND date >= ?`,
      userId,
      since,
    );
    if (rhrRow?.v && !current.restingHr) {
      patch.restingHr = Math.round(rhrRow.v);
      reasons.restingHr = "Moyenne 60j depuis tes wearables";
    }

    const hrvRow = one<{ v: number }>(
      `SELECT AVG(value) as v FROM wearable_metric WHERE user_id = ? AND kind = 'hrv' AND date >= ?`,
      userId,
      since,
    );
    if (hrvRow?.v && !current.hrv) {
      patch.hrv = Math.round(hrvRow.v);
      reasons.hrv = "HRV moyenne 60j depuis tes wearables";
    }

    const sleepRow = one<{ v: number }>(
      `SELECT AVG(value) as v FROM wearable_metric WHERE user_id = ? AND kind = 'sleep_total_min' AND date >= ?`,
      userId,
      since,
    );
    if (sleepRow?.v && !current.sleepHours) {
      patch.sleepHours = Math.round((sleepRow.v / 60) * 10) / 10;
      reasons.sleepHours = "Sommeil moyen 60j depuis tes wearables (converti en h)";
    }
  } catch {}

  // ============================================================
  // 4) Nutrition preferences -> dietType, allergiesFood
  // ============================================================
  try {
    const np = one<{
      diet_type: string;
      allergies: string;
      aversions: string;
      cuisines: string;
    }>(`SELECT diet_type, allergies, aversions, cuisines FROM nutrition_pref WHERE user_id = ? LIMIT 1`, userId);
    if (np) {
      const dietMap: Record<string, string> = {
        omnivore: "Omnivore",
        flexitarian: "Flexitarien",
        pescatarian: "Pescetarien",
        vegetarian: "Végétarien",
        vegan: "Vegan",
        carnivore: "Carnivore",
        keto: "Cétogène",
        paleo: "Paléo",
        mediterranean: "Méditerranéen",
      };
      const mapped = dietMap[np.diet_type?.toLowerCase()] ?? "";
      if (mapped && !current.dietType) {
        patch.dietType = mapped;
        reasons.dietType = "Depuis tes préférences nutrition";
      }
      try {
        const a = JSON.parse(np.allergies || "[]") as string[];
        if (Array.isArray(a) && a.length && !current.allergiesFood) {
          patch.allergiesFood = a.join(", ");
          reasons.allergiesFood = "Depuis tes préférences nutrition";
        }
      } catch {}
      if (np.aversions && !current.foodsAvoided) {
        patch.foodsAvoided = np.aversions;
        reasons.foodsAvoided = "Depuis tes préférences nutrition";
      }
    }
  } catch {}

  // ============================================================
  // 5) Current supplements -> supplements (textarea + count)
  // ============================================================
  try {
    const sups = rows<{ name: string; dose: string | null; unit: string | null; timing: string | null }>(
      `SELECT name, dose, unit, timing FROM supplement WHERE user_id = ? AND (ended_at IS NULL OR ended_at = 0) ORDER BY started_at DESC NULLS LAST`,
      userId,
    );
    if (sups.length > 0 && !current.supplements) {
      patch.supplements = sups
        .map((s) => {
          const parts = [s.name];
          if (s.dose) parts.push(`${s.dose}${s.unit ?? ""}`);
          if (s.timing) parts.push(s.timing);
          return parts.join(" — ");
        })
        .join("\n");
      reasons.supplements = `${sups.length} compléments actifs depuis ta stack`;
    }
  } catch {}

  // ============================================================
  // 6) Recent active symptoms -> symptomsActive (last 14d, value>=4)
  // ============================================================
  try {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const recent = rows<{ key: string }>(
      `SELECT DISTINCT key FROM symptom_log WHERE user_id = ? AND date >= ? AND value >= 4`,
      userId,
      since,
    );
    if (recent.length > 0) {
      const cur = (current.activeSymptoms as string[] | undefined) ?? [];
      const merged = Array.from(new Set([...cur, ...recent.map((r) => r.key)]));
      if (merged.length !== cur.length) {
        patch.activeSymptoms = merged;
        reasons.activeSymptoms = `${recent.length} symptômes loggés ≥4 dans les 14 derniers jours`;
      }
    }
  } catch {}

  // ============================================================
  // 7) Last consultation document -> screeningHistory.checkup
  // ============================================================
  try {
    const r = one<{ d: number }>(
      `SELECT MAX(date) as d FROM document WHERE user_id = ? AND (category = 'consultation' OR category = 'consultations')`,
      userId,
    );
    if (r?.d) {
      const iso = new Date(r.d).toISOString().slice(0, 10);
      const sh = (patch.screeningHistory as Record<string, { lastDate?: string }>) ?? (current.screeningHistory as Record<string, { lastDate?: string }>) ?? {};
      if (!sh.checkup?.lastDate) {
        patch.screeningHistory = { ...sh, checkup: { lastDate: iso } };
        reasons.screeningHistory =
          (reasons.screeningHistory ?? "") +
          (reasons.screeningHistory ? " ; " : "") +
          `Dernière consultation le ${iso}`;
      }
    }
  } catch {}

  // ============================================================
  // 8) DNA-flagged high-risk categories -> primaryGoals suggestion
  // ============================================================
  try {
    const flagged = rows<{ category: string; n: number }>(
      `SELECT category, COUNT(*) as n FROM dna_insight WHERE user_id = ? AND has_risk = 1 GROUP BY category ORDER BY n DESC LIMIT 5`,
      userId,
    );
    if (flagged.length > 0) {
      const dnaToGoal: Record<string, string> = {
        longevity: "Longévité",
        cardiovascular: "Santé cardiaque",
        cardio: "Santé cardiaque",
        cognitive: "Optimisation cognitive",
        neuro: "Optimisation cognitive",
        metabolic: "Énergie",
        immunity: "Immunité",
        sleep: "Meilleur sommeil",
        hormones: "Hormones",
        cancer: "Longévité",
      };
      const suggestedGoals = new Set<string>();
      for (const f of flagged) {
        const goal = dnaToGoal[f.category.toLowerCase()];
        if (goal) suggestedGoals.add(goal);
      }
      const cur = (current.primaryGoals as string[] | undefined) ?? [];
      if (cur.length === 0 && suggestedGoals.size > 0) {
        patch.primaryGoals = Array.from(suggestedGoals).slice(0, 4);
        reasons.primaryGoals = `Suggéré depuis ${flagged.length} catégories ADN à risque`;
      }
    }
  } catch {}

  // ============================================================
  // 9) Anthropometric from wearable_metric (weight if scale connected)
  // ============================================================
  try {
    const latestWeight = one<{ v: number }>(
      `SELECT value as v FROM wearable_metric WHERE user_id = ? AND kind = 'weight' ORDER BY date DESC LIMIT 1`,
      userId,
    );
    if (latestWeight?.v && !current.weight) {
      patch.weight = Math.round(latestWeight.v * 10) / 10;
      reasons.weight = "Dernière mesure depuis ta balance connectée";
    }
    const latestBf = one<{ v: number }>(
      `SELECT value as v FROM wearable_metric WHERE user_id = ? AND kind = 'body_fat' ORDER BY date DESC LIMIT 1`,
      userId,
    );
    if (latestBf?.v && !current.bodyFat) {
      patch.bodyFat = Math.round(latestBf.v * 10) / 10;
      reasons.bodyFat = "Dernière mesure depuis ta balance connectée";
    }
    const latestVo2 = one<{ v: number }>(
      `SELECT value as v FROM wearable_metric WHERE user_id = ? AND kind = 'vo2max' ORDER BY date DESC LIMIT 1`,
      userId,
    );
    if (latestVo2?.v && !current.vo2max) {
      patch.vo2max = Math.round(latestVo2.v * 10) / 10;
      reasons.vo2max = "Dernière mesure VO2max depuis tes wearables";
    }
  } catch {}

  // 10) Sport regularity buckets unused for now — would need habit_log.key conventions.

  return { patch, reasons };
}

// Note unused imports for type-only re-export reference.
export type { FrequencyBucket, YesNoUnknown };

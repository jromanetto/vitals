/**
 * Deterministic profile pre-fill. Queries the database for facts the user has
 * already given us (blood panel dates, wearables in use, current supplements,
 * recent symptoms, nutrition preferences) and returns a partial profile patch.
 *
 * No LLM calls — runs in ~50ms. Pure read-only. Caller (the API route) compares
 * against the current profile and presents only the deltas to the user.
 */
import { db } from "@/lib/db";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
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

function one<T = RawRow>(sql: string, ...params: unknown[]): T | undefined {
  const sqlite = db().$client;
  return sqlite.prepare(sql).get(...params) as T | undefined;
}

export async function computePrefill(userId: number, current: Record<string, unknown>): Promise<{
  patch: PrefillPatch;
  reasons: Record<string, string>;
}> {
  const patch: PrefillPatch = {};
  const reasons: Record<string, string> = {};

  // Migrated tables now read via Convex (self scope: authUserId = viewUserId = userId).
  // Each read is wrapped so a single fetch failure degrades gracefully (mirrors the
  // legacy per-block try/catch). `document` (block 7) stays on SQLite.
  const conv = convexServer();
  const q = { secret: bridgeSecret(), authUserId: userId, viewUserId: userId };

  let biomarkerRows: FunctionReturnType<typeof api.biomarkers.all>["rows"] = [];
  try {
    biomarkerRows = (await conv.query(api.biomarkers.all, q)).rows;
  } catch {}

  // wearables.overview with days=365 (the query caps at 365): `sources` is all-time
  // (DISTINCT source), `rows` are date-bounded to the requested window (used for the
  // 60d averages and the "latest measurement" reads).
  let wearRows: Array<{ date: string; source: string; kind: string; value: number; unit: string | null }> = [];
  let wearSources: Array<{ source: string }> = [];
  try {
    const ov = await conv.query(api.wearables.overview, { ...q, days: 365 });
    wearRows = ov.rows;
    wearSources = ov.sources;
  } catch {}

  let nutrition: { dietType: string; allergies: string; aversions: string; cuisines: string } | null = null;
  try {
    nutrition = (await conv.query(api.profile.nutritionPref, q)).row;
  } catch {}

  let supplementRows: FunctionReturnType<typeof api.supplements.list>["rows"] = [];
  try {
    supplementRows = (await conv.query(api.supplements.list, q)).rows;
  } catch {}

  let symptomRows: FunctionReturnType<typeof api.symptoms.list>["rows"] = [];
  try {
    symptomRows = (await conv.query(api.symptoms.list, { ...q, days: 14 })).rows;
  } catch {}

  let dnaRows: FunctionReturnType<typeof api.dna.insights>["rows"] = [];
  try {
    dnaRows = (await conv.query(api.dna.insights, q)).rows;
  } catch {}

  // ============================================================
  // 1) Last full blood panel date -> screeningHistory.blood_panel
  // ============================================================
  try {
    if (biomarkerRows.length > 0) {
      const maxDate = Math.max(...biomarkerRows.map((r) => r.date)); // MAX(date)
      if (maxDate) {
        const iso = new Date(maxDate).toISOString().slice(0, 10);
        const sh = (current.screeningHistory as Record<string, { lastDate?: string }>) ?? {};
        if (!sh.blood_panel?.lastDate) {
          patch.screeningHistory = { ...sh, blood_panel: { lastDate: iso } };
          reasons.screeningHistory = `Dernier biomarqueur enregistré le ${iso}`;
        }
      }
    }
  } catch {}

  // ============================================================
  // 2) Wearables owned -> distinct sources in wearable_metric
  // ============================================================
  try {
    const owned: WearableId[] = [];
    for (const s of wearSources) {
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
    // AVG(value) WHERE kind = ? AND date >= since (across all sources), in JS.
    const avgKind = (kind: string): number | null => {
      const vals = wearRows.filter((r) => r.kind === kind && r.date >= since).map((r) => r.value);
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const rhr = avgKind("rhr");
    if (rhr && !current.restingHr) {
      patch.restingHr = Math.round(rhr);
      reasons.restingHr = "Moyenne 60j depuis tes wearables";
    }

    const hrv = avgKind("hrv");
    if (hrv && !current.hrv) {
      patch.hrv = Math.round(hrv);
      reasons.hrv = "HRV moyenne 60j depuis tes wearables";
    }

    const sleep = avgKind("sleep_total_min");
    if (sleep && !current.sleepHours) {
      const hours = sleep / 60;
      // Bucket to match the chips offered in the wizard ["<5", "5-6", ..., "9+"].
      let bucket = "9+";
      if (hours < 5) bucket = "<5";
      else if (hours < 6) bucket = "5-6";
      else if (hours < 7) bucket = "6-7";
      else if (hours < 8) bucket = "7-8";
      else if (hours < 9) bucket = "8-9";
      patch.sleepHours = bucket;
      reasons.sleepHours = `Sommeil moyen 60j depuis tes wearables (~${hours.toFixed(1)}h)`;
    }
  } catch {}

  // ============================================================
  // 4) Nutrition preferences -> dietType, allergiesFood
  // ============================================================
  try {
    if (nutrition) {
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
      const mapped = dietMap[nutrition.dietType?.toLowerCase()] ?? "";
      if (mapped && !current.dietType) {
        patch.dietType = mapped;
        reasons.dietType = "Depuis tes préférences nutrition";
      }
      try {
        const a = JSON.parse(nutrition.allergies || "[]") as string[];
        if (Array.isArray(a) && a.length && !current.allergiesFood) {
          patch.allergiesFood = a.join(", ");
          reasons.allergiesFood = "Depuis tes préférences nutrition";
        }
      } catch {}
      if (nutrition.aversions && !current.foodsAvoided) {
        patch.foodsAvoided = nutrition.aversions;
        reasons.foodsAvoided = "Depuis tes préférences nutrition";
      }
    }
  } catch {}

  // ============================================================
  // 5) Current supplements -> supplements (textarea + count)
  // ============================================================
  try {
    // active (endedAt null/0), then ORDER BY startedAt DESC NULLS LAST — reproduced in JS.
    // list() rows are Record<string, unknown>; coerce the fields we read.
    const sups = supplementRows
      .map((s) => ({
        name: String(s.name ?? ""),
        dose: s.dose == null ? null : String(s.dose),
        unit: s.unit == null ? null : String(s.unit),
        timing: s.timing == null ? null : String(s.timing),
        endedAt: typeof s.endedAt === "number" ? s.endedAt : null,
        startedAt: typeof s.startedAt === "number" ? s.startedAt : null,
      }))
      .filter((s) => s.endedAt == null || s.endedAt === 0)
      .sort((a, b) => {
        if (a.startedAt == null && b.startedAt == null) return 0;
        if (a.startedAt == null) return 1; // NULLS LAST
        if (b.startedAt == null) return -1;
        return b.startedAt - a.startedAt; // DESC
      });
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
    // symptomRows already windowed to 14d by the Convex fn; keep value>=4 + DISTINCT key.
    const recentKeys = Array.from(
      new Set(symptomRows.filter((r) => r.value >= 4).map((r) => r.key)),
    );
    if (recentKeys.length > 0) {
      const cur = (current.activeSymptoms as string[] | undefined) ?? [];
      const merged = Array.from(new Set([...cur, ...recentKeys]));
      if (merged.length !== cur.length) {
        patch.activeSymptoms = merged;
        reasons.activeSymptoms = `${recentKeys.length} symptômes loggés ≥4 dans les 14 derniers jours`;
      }
    }
  } catch {}

  // ============================================================
  // 7) Last consultation document -> screeningHistory.checkup  (SQLite — kept)
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
    // GROUP BY category, COUNT(*) WHERE has_risk = 1, ORDER BY n DESC LIMIT 5 — in JS.
    const counts = new Map<string, number>();
    for (const r of dnaRows) {
      if (r.hasRisk === 1) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
    const flagged = [...counts.entries()]
      .map(([category, n]) => ({ category, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
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
    // Latest measurement per kind = row with the greatest date (ISO string) in window.
    // CAVEAT: bounded to the 365d wearables.overview window (legacy was all-time).
    const latestKind = (kind: string): number | null => {
      let best: { date: string; value: number } | null = null;
      for (const r of wearRows) {
        if (r.kind !== kind) continue;
        if (!best || r.date > best.date) best = { date: r.date, value: r.value };
      }
      return best ? best.value : null;
    };

    const weight = latestKind("weight");
    if (weight && !current.weight) {
      patch.weight = Math.round(weight * 10) / 10;
      reasons.weight = "Dernière mesure depuis ta balance connectée";
    }
    const bf = latestKind("body_fat");
    if (bf && !current.bodyFat) {
      patch.bodyFat = Math.round(bf * 10) / 10;
      reasons.bodyFat = "Dernière mesure depuis ta balance connectée";
    }
    const vo2 = latestKind("vo2max");
    if (vo2 && !current.vo2max) {
      patch.vo2max = Math.round(vo2 * 10) / 10;
      reasons.vo2max = "Dernière mesure VO2max depuis tes wearables";
    }
  } catch {}

  // 10) Sport regularity buckets unused for now — would need habit_log.key conventions.

  return { patch, reasons };
}

// Note unused imports for type-only re-export reference.
export type { FrequencyBucket, YesNoUnknown };

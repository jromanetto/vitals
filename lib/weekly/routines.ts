/**
 * Derive the list of routines to track each week from what the user already
 * declared in their health profile (/data/profile). The point: don't ask "how
 * many sport sessions this week?" in a vacuum — say "you declared Modéré
 * (3-4x/sem), how many did you actually do? ✓ on target / ⚠ below / ↗ above."
 *
 * Mapping source: components/profile-form.tsx chipsSingle + frequency fields.
 * Frequency buckets come from lib/medical/types.ts: never | rare | sometimes
 * | often | daily.
 */

export type DerivedRoutine = {
  id: string;
  label: string;
  hint?: string;
  target: { min: number; max: number; unit: string };
  weeklyMax: number; // upper bound of the picker
  source: "profile" | "default";
};

type ProfileLike = Record<string, unknown>;

function getStr(p: ProfileLike, key: string): string | undefined {
  const v = p[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function freqToWeekly(bucket: string | undefined): { min: number; max: number } | null {
  if (!bucket || bucket === "never") return null;
  if (bucket === "rare") return { min: 1, max: 2 };
  if (bucket === "sometimes") return { min: 2, max: 4 };
  if (bucket === "often") return { min: 4, max: 6 };
  if (bucket === "daily") return { min: 7, max: 7 };
  return null;
}

const ACTIVITY_TARGETS: Record<string, [number, number]> = {
  "Léger (1-2x/sem)": [1, 2],
  "Modéré (3-4x/sem)": [3, 4],
  "Intense (5-6x/sem)": [5, 6],
  "Athlète": [6, 14],
};

const MEDITATION_TARGETS: Record<string, [number, number]> = {
  Occasionnel: [1, 2],
  Hebdo: [1, 2],
  Quotidien: [7, 7],
};

export function deriveRoutinesFromProfile(profile: ProfileLike): DerivedRoutine[] {
  const out: DerivedRoutine[] = [];
  const push = (r: Omit<DerivedRoutine, "source">) => out.push({ ...r, source: "profile" });

  // Sport / mouvement — from activityLevel
  const al = getStr(profile, "activityLevel");
  if (al && al !== "Sédentaire") {
    const [min, max] = ACTIVITY_TARGETS[al] || [3, 4];
    push({
      id: "training_sessions",
      label: "Sport / mouvement",
      hint: `tu as déclaré : ${al}`,
      target: { min, max, unit: "sessions" },
      weeklyMax: 14,
    });
  }

  // Sleep target nights — from sleepHours
  const sh = getStr(profile, "sleepHours");
  if (sh && sh !== "<5") {
    push({
      id: "sleep_target_nights",
      label: `Nuits de ${sh}h`,
      hint: `ta cible déclarée : ${sh}h/nuit`,
      target: { min: 5, max: 7, unit: "nuits" },
      weeklyMax: 7,
    });
  }

  // Meditation — from meditation
  const med = getStr(profile, "meditation");
  if (med && med !== "Jamais") {
    const [min, max] = MEDITATION_TARGETS[med] || [1, 2];
    push({
      id: "meditation_sessions",
      label: "Méditation / respiration",
      hint: `tu as déclaré : ${med}`,
      target: { min, max, unit: "sessions" },
      weeklyMax: 14,
    });
  }

  // Intermittent fasting days
  const fast = getStr(profile, "intermittentFasting");
  if (fast && fast !== "Non") {
    push({
      id: "fasting_days",
      label: `Jeûne ${fast}`,
      hint: "ta routine déclarée",
      target: { min: 5, max: 7, unit: "jours" },
      weeklyMax: 7,
    });
  }

  // Water target days
  const water = getStr(profile, "waterLiters");
  if (water && water !== "<0.5L") {
    push({
      id: "water_target_days",
      label: `Hydratation ${water}/jour`,
      hint: "cible quotidienne déclarée",
      target: { min: 5, max: 7, unit: "jours" },
      weeklyMax: 7,
    });
  }

  // Frequency-typed routines (morning light, sauna, cold, stretching, breathwork…)
  const freqRoutines: Array<{ field: string; id: string; label: string; unit: string; hint?: string; weeklyMax?: number }> = [
    { field: "morningLight", id: "morning_light", label: "Lumière du matin", unit: "jours", hint: "10 min dehors au lever" },
    { field: "saunaSessions", id: "sauna", label: "Sauna", unit: "sessions", weeklyMax: 14 },
    { field: "coldExposure", id: "cold_exposure", label: "Exposition froid", unit: "sessions", hint: "douche/bain froid", weeklyMax: 14 },
    { field: "stretching", id: "stretching", label: "Étirements / mobilité", unit: "sessions", weeklyMax: 14 },
    { field: "breathwork", id: "breathwork", label: "Breathwork / cohérence cardiaque", unit: "sessions", weeklyMax: 14 },
  ];
  for (const r of freqRoutines) {
    const tgt = freqToWeekly(getStr(profile, r.field));
    if (!tgt) continue;
    push({
      id: r.id,
      label: r.label,
      hint: r.hint,
      target: { min: tgt.min, max: tgt.max, unit: r.unit },
      weeklyMax: r.weeklyMax ?? 7,
    });
  }

  return out;
}

export const DEFAULT_ROUTINES: DerivedRoutine[] = [
  { id: "sleep_7h", label: "Sommeil ≥ 7h", target: { min: 5, max: 7, unit: "nuits" }, weeklyMax: 7, source: "default" },
  { id: "water_2L", label: "Hydratation ≥ 2L", target: { min: 5, max: 7, unit: "jours" }, weeklyMax: 7, source: "default" },
  { id: "training", label: "Sport / mouvement", target: { min: 3, max: 5, unit: "sessions" }, weeklyMax: 14, source: "default" },
  { id: "fasting_14h", label: "Jeûne ≥ 14h", target: { min: 3, max: 7, unit: "jours" }, weeklyMax: 7, source: "default" },
  { id: "sun", label: "Lumière naturelle matin", target: { min: 5, max: 7, unit: "jours" }, weeklyMax: 7, source: "default" },
  { id: "meditation", label: "Méditation / respiration", target: { min: 3, max: 7, unit: "sessions" }, weeklyMax: 14, source: "default" },
  { id: "cold_exposure", label: "Exposition froid", target: { min: 1, max: 3, unit: "sessions" }, weeklyMax: 14, source: "default" },
];

export function getRoutinesOrDefault(profile: ProfileLike): { routines: DerivedRoutine[]; fromProfile: boolean } {
  const derived = deriveRoutinesFromProfile(profile);
  if (derived.length === 0) return { routines: DEFAULT_ROUTINES, fromProfile: false };
  return { routines: derived, fromProfile: true };
}

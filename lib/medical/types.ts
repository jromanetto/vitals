// Shared types for the structured medical data layer.
// All structures are stored inside profile.data JSON.

export type YesNoUnknown = "yes" | "no" | "unknown";

export type FrequencyBucket =
  | "never"
  | "rare"        // < 1/mois
  | "sometimes"   // qq fois par mois
  | "often"       // qq fois par semaine
  | "daily";

export const FREQUENCY_LABELS_FR: Record<FrequencyBucket, string> = {
  never: "Jamais",
  rare: "Rarement",
  sometimes: "Parfois",
  often: "Souvent",
  daily: "Quotidien",
};

export type RelativeKey =
  | "father"
  | "mother"
  | "paternalGrandfather"
  | "paternalGrandmother"
  | "maternalGrandfather"
  | "maternalGrandmother"
  | "siblings"
  | "children"
  | "paternalUncleAunt"
  | "maternalUncleAunt";

export type Relative = {
  key: RelativeKey;
  label: string;
  side: "self" | "paternal" | "maternal" | "common";
  generation: 0 | 1 | 2; // 0 = self/siblings/children, 1 = parents/uncles, 2 = grandparents
};

export type DiseaseCategory =
  | "cardio"
  | "metabolic"
  | "cancer"
  | "neuro"
  | "autoimmune"
  | "psy"
  | "hema"
  | "renal"
  | "hepatic"
  | "ent_eye"
  | "bone";

export type DiseaseEntry = {
  id: string;
  label: string;
  category: DiseaseCategory;
  // 0..1 — heuristic genetic contribution. Used to weight family history → personal risk.
  heritability: number;
  icd10?: string;
};

export type FamilyDiseaseEntry = {
  status: YesNoUnknown;
  // age of diagnosis (years). 0/undef = unknown.
  ageOfDiagnosis?: number;
  // for deceased relatives: cause of death + age (only meaningful if status=yes for the cause).
  causeOfDeath?: boolean;
  ageAtDeath?: number;
  notes?: string;
};

// Indexed by `${RelativeKey}.${DiseaseId}`.
// Example: { "father.t2d": { status: "yes", ageOfDiagnosis: 58 } }
export type FamilyHistory = Record<string, FamilyDiseaseEntry>;

export type SymptomCategory =
  | "general"
  | "cardio"
  | "neuro"
  | "digestive"
  | "musculoskeletal"
  | "skin"
  | "respiratory"
  | "urogenital"
  | "mental"
  | "metabolic";

export type SymptomEntry = {
  id: string;
  label: string;
  category: SymptomCategory;
  redFlag?: boolean; // surface as "to discuss with doctor"
};

export type ScreeningCadence = "1y" | "2y" | "3y" | "5y" | "10y" | "once";

export type ScreeningEntry = {
  id: string;
  label: string;
  description?: string;
  cadence: ScreeningCadence;
  // who it applies to (if undef → everyone)
  sex?: "male" | "female";
  minAge?: number;
  maxAge?: number;
};

// Stored as record indexed by screening id: { lastDate: ISO string, status: "done"|"due"|"overdue" }
export type ScreeningHistory = Record<string, { lastDate?: string }>;

export type WearableId =
  | "whoop"
  | "oura"
  | "appleWatch"
  | "garmin"
  | "fitbit"
  | "polar"
  | "withings"
  | "cgm"
  | "bpMonitor"
  | "smartScale";

export const WEARABLE_LABELS_FR: Record<WearableId, string> = {
  whoop: "Whoop",
  oura: "Oura",
  appleWatch: "Apple Watch",
  garmin: "Garmin",
  fitbit: "Fitbit",
  polar: "Polar",
  withings: "Withings",
  cgm: "Glucomètre continu (CGM)",
  bpMonitor: "Tensiomètre",
  smartScale: "Balance connectée",
};

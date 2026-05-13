/**
 * Deterministic signal selection for the Welcome Report.
 *
 * Given a user's profile + biomarkers + DNA insights + family history, picks
 * the top 3 most actionable signals to surface. Pure functions, no LLM, fast
 * (<10ms). The LLM is invoked later by generate.ts only to phrase each
 * signal into a 3-line card.
 *
 * The three cards :
 *  1. "À surveiller" — worst biomarker × clinical weight, amplified by
 *     genetic + family cross-references.
 *  2. "Force génétique" — strongest protective DNA insight, with lifestyle
 *     fallback if no DNA was uploaded.
 *  3. "Risque familial actionnable" — top heritable family risk paired with
 *     an applicable screening, with symptoms fallback if family is empty.
 */
import { DISEASE_CATALOG } from "@/lib/medical/disease-catalog";
import { SYMPTOM_CATALOG } from "@/lib/medical/symptom-catalog";
import { applicableScreenings, SCREENING_CATALOG } from "@/lib/medical/screening-catalog";
import { RELATIVES } from "@/lib/medical/relatives";
import type { FamilyHistory, ScreeningEntry } from "@/lib/medical/types";

// =================== Types ===================

export type BiomarkerRow = {
  name: string;
  slug: string;
  value: number;
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
  date: number; // unix ms
};

export type DnaInsightRow = {
  rsid: string;
  category: string;
  trait: string;
  effect?: string | null;
  magnitude?: number | null;
  riskAllele?: string | null;
  userGenotype?: string | null;
  hasRisk?: boolean | null;
  isProtective?: boolean | null;
  summary?: string | null;
};

export type SignalCard1 = {
  kind: "biomarker";
  biomarker: BiomarkerRow;
  optimalRange?: { low: number; high: number };
  severityScore: number;
  amplifyingDna?: DnaInsightRow;
  amplifyingFamily?: { relativeKey: string; diseaseId: string; diseaseLabel: string };
};

export type SignalCard2 =
  | { kind: "dna-protective"; dna: DnaInsightRow }
  | { kind: "lifestyle-fallback"; positives: string[] };

export type SignalCard3 =
  | {
      kind: "family-risk";
      relativeKey: string;
      diseaseId: string;
      diseaseLabel: string;
      ageOfDiagnosis?: number;
      heritability: number;
      screening?: ScreeningEntry;
    }
  | { kind: "symptoms-fallback"; redFlagSymptoms: string[]; otherSymptoms: string[] };

export type SignalSet = {
  card1?: SignalCard1;
  card2?: SignalCard2;
  card3?: SignalCard3;
  redFlagAlert?: { symptomIds: string[]; labels: string[] };
};

// =================== Clinical weights ===================

// Higher = more clinically meaningful for risk stratification.
const CLINICAL_WEIGHT: Record<string, number> = {
  // Lipids / cardio
  ldl: 5, apob: 5, "lp-a": 5, "lpa": 5,
  hdl: 3, triglycerides: 3, "cholesterol-total": 2,
  // Glucose / metabolic
  hba1c: 5, glucose: 4, insulin: 4, homa: 4,
  // Inflammation
  crp: 5, hscrp: 5, fibrinogen: 3,
  // Iron
  ferritin: 4, ferritine: 4, transferrin: 3,
  // Thyroid
  tsh: 3, t3: 2, t4: 2,
  // Liver
  alat: 3, asat: 3, ggt: 3, "gamma-gt": 3,
  // Renal
  creatinine: 3, "creatinine-clearance": 3, "egfr": 3,
  // Vitamins
  "vitamin-d": 4, "vitamine-d": 4, "b12": 3, "vitamine-b12": 3, folate: 3,
  // Homocysteine
  homocysteine: 4, "homocysteine-totale": 4,
  // Hormones
  testosterone: 3, estradiol: 3, cortisol: 3,
};

function clinicalWeight(slug: string): number {
  return CLINICAL_WEIGHT[slug.toLowerCase()] ?? 1;
}

// =================== Helpers ===================

function deviationScore(value: number, refLow: number | null | undefined, refHigh: number | null | undefined): number {
  if (refLow == null && refHigh == null) return 0;
  const lo = refLow ?? -Infinity;
  const hi = refHigh ?? Infinity;
  if (value >= lo && value <= hi) return 0;
  const distance = value < lo ? lo - value : value - hi;
  const range = (refHigh ?? 0) - (refLow ?? 0) || 1;
  return distance / range;
}

// One biomarker per slug, the most recent.
function dedupeLatestBySlug(rows: BiomarkerRow[]): BiomarkerRow[] {
  const seen = new Map<string, BiomarkerRow>();
  for (const r of rows) {
    const cur = seen.get(r.slug);
    if (!cur || r.date > cur.date) seen.set(r.slug, r);
  }
  return Array.from(seen.values());
}

// =================== Card 1 ===================

const DNA_AMPLIFIES: Record<string, string[]> = {
  // biomarker slug → DNA traits/categories that amplify the risk
  ldl: ["apoe", "cholesterol", "ldl", "cvd"],
  apob: ["apoe", "cholesterol", "cvd"],
  ferritin: ["hfe", "iron", "hemochromatosis"],
  ferritine: ["hfe", "iron", "hemochromatosis"],
  hba1c: ["tcf7l2", "t2d", "diabetes"],
  glucose: ["tcf7l2", "t2d", "diabetes"],
  crp: ["inflammation"],
  hscrp: ["inflammation"],
  "vitamin-d": ["vdr", "vitamin-d"],
  "vitamine-d": ["vdr", "vitamin-d"],
};

const FAMILY_AMPLIFIES: Record<string, string[]> = {
  ldl: ["mi", "stroke", "fh_chol"],
  apob: ["mi", "stroke", "fh_chol"],
  hba1c: ["t2d", "t1d"],
  glucose: ["t2d", "t1d"],
  crp: ["ra", "lupus", "crohn"],
};

function findAmplifyingDna(biomarkerSlug: string, dna: DnaInsightRow[]): DnaInsightRow | undefined {
  const hints = DNA_AMPLIFIES[biomarkerSlug.toLowerCase()];
  if (!hints) return undefined;
  for (const d of dna) {
    if (!d.hasRisk) continue;
    const hay = `${d.rsid} ${d.category} ${d.trait}`.toLowerCase();
    if (hints.some((h) => hay.includes(h))) return d;
  }
  return undefined;
}

function findAmplifyingFamily(
  biomarkerSlug: string,
  fh: FamilyHistory,
): { relativeKey: string; diseaseId: string; diseaseLabel: string } | undefined {
  const hints = FAMILY_AMPLIFIES[biomarkerSlug.toLowerCase()];
  if (!hints) return undefined;
  for (const [k, entry] of Object.entries(fh)) {
    if (entry?.status !== "yes") continue;
    const [rel, diseaseId] = k.split(".");
    if (!hints.includes(diseaseId)) continue;
    const d = DISEASE_CATALOG.find((x) => x.id === diseaseId);
    if (!d) continue;
    return { relativeKey: rel, diseaseId, diseaseLabel: d.label };
  }
  return undefined;
}

function selectCard1(
  biomarkers: BiomarkerRow[],
  dna: DnaInsightRow[],
  fh: FamilyHistory,
): SignalCard1 | undefined {
  if (biomarkers.length === 0) return undefined;
  const latest = dedupeLatestBySlug(biomarkers);
  let best: SignalCard1 | undefined;
  for (const b of latest) {
    const dev = deviationScore(b.value, b.refLow, b.refHigh);
    if (dev <= 0) continue;
    const w = clinicalWeight(b.slug);
    const amplifyingDna = findAmplifyingDna(b.slug, dna);
    const amplifyingFamily = findAmplifyingFamily(b.slug, fh);
    const amplifier = (amplifyingDna ? 1 : 0) + (amplifyingFamily ? 1 : 0);
    const score = dev * w * (1 + amplifier);
    if (!best || score > best.severityScore) {
      best = {
        kind: "biomarker",
        biomarker: b,
        optimalRange: b.refLow != null && b.refHigh != null ? { low: b.refLow, high: b.refHigh } : undefined,
        severityScore: score,
        amplifyingDna,
        amplifyingFamily,
      };
    }
  }
  return best;
}

// =================== Card 2 ===================

const DNA_CATEGORY_WEIGHT: Record<string, number> = {
  longevity: 5,
  cardio: 4,
  cardiovascular: 4,
  cancer: 4,
  metabolic: 3,
  cognitive: 3,
  neuro: 3,
  immunity: 3,
  hormones: 2,
  sleep: 2,
};

function selectCard2(dna: DnaInsightRow[], profile: Record<string, any>): SignalCard2 | undefined {
  // Try DNA protective first.
  const candidates = dna.filter((d) => d.isProtective || (d.magnitude != null && d.magnitude > 0.5));
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const wa = (DNA_CATEGORY_WEIGHT[a.category.toLowerCase()] ?? 1) * (a.magnitude ?? 0.5);
      const wb = (DNA_CATEGORY_WEIGHT[b.category.toLowerCase()] ?? 1) * (b.magnitude ?? 0.5);
      return wb - wa;
    });
    return { kind: "dna-protective", dna: candidates[0] };
  }
  // Lifestyle fallback.
  const positives: string[] = [];
  if (profile.activityLevel && /Intense|Athlète|Modéré/.test(profile.activityLevel)) {
    positives.push(`Niveau d'activité ${profile.activityLevel}`);
  }
  if (profile.sleepHours && /^(7|8|9)/.test(String(profile.sleepHours))) {
    positives.push(`Sommeil ${profile.sleepHours}h/nuit`);
  }
  if (profile.dietType && /(Méditerranéen|Pescetarien|Végétarien|Vegan)/.test(profile.dietType)) {
    positives.push(`Alimentation ${profile.dietType}`);
  }
  if (profile.smoker === "Non") positives.push("Non-fumeur");
  if (positives.length === 0) return undefined;
  return { kind: "lifestyle-fallback", positives };
}

// =================== Card 3 ===================

function selectCard3(
  fh: FamilyHistory,
  age: number | undefined,
  sex: "male" | "female" | undefined,
  activeSymptoms: string[],
): SignalCard3 | undefined {
  // Score each family disease entry.
  const candidates: Array<{
    relativeKey: string;
    diseaseId: string;
    diseaseLabel: string;
    heritability: number;
    ageOfDiagnosis?: number;
    score: number;
  }> = [];

  for (const [k, entry] of Object.entries(fh)) {
    if (entry?.status !== "yes") continue;
    const [rel, diseaseId] = k.split(".");
    const disease = DISEASE_CATALOG.find((d) => d.id === diseaseId);
    if (!disease) continue;
    const dxAge = entry.ageOfDiagnosis;
    const ageWeight = dxAge ? 50 / Math.max(dxAge, 30) : 1;
    const relWeight = RELATIVES.find((r) => r.key === rel)?.generation === 1 ? 1.5 : 1.0;
    candidates.push({
      relativeKey: rel,
      diseaseId,
      diseaseLabel: disease.label,
      heritability: disease.heritability,
      ageOfDiagnosis: dxAge,
      score: disease.heritability * ageWeight * relWeight,
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    // Match to applicable screening (best effort, by disease keyword).
    const apps = applicableScreenings(age, sex);
    const screening = apps.find((s) => {
      const lab = s.label.toLowerCase();
      const did = top.diseaseId.toLowerCase();
      if (did.startsWith("cancer_breast")) return lab.includes("mammo") || lab.includes("hpv");
      if (did.startsWith("cancer_prostate")) return lab.includes("psa") || lab.includes("prostate");
      if (did.startsWith("cancer_colon")) return lab.includes("colon") || lab.includes("hémoccult") || lab.includes("fobt");
      if (did === "t2d" || did === "t1d") return lab.includes("bilan sanguin");
      if (did === "mi" || did === "stroke" || did === "htn") return lab.includes("ecg") || lab.includes("écho card") || lab.includes("bilan sanguin");
      if (did === "osteoporosis" || did === "hip_fracture") return lab.includes("dexa") || lab.includes("ostéo");
      return false;
    });
    return {
      kind: "family-risk",
      relativeKey: top.relativeKey,
      diseaseId: top.diseaseId,
      diseaseLabel: top.diseaseLabel,
      ageOfDiagnosis: top.ageOfDiagnosis,
      heritability: top.heritability,
      screening,
    };
  }

  // Symptoms fallback.
  if (Array.isArray(activeSymptoms) && activeSymptoms.length > 0) {
    const sympCatalog = SYMPTOM_CATALOG.filter((s) => activeSymptoms.includes(s.id));
    const redFlagSymptoms = sympCatalog.filter((s) => s.redFlag).map((s) => s.label);
    const otherSymptoms = sympCatalog.filter((s) => !s.redFlag).map((s) => s.label);
    if (sympCatalog.length > 0) return { kind: "symptoms-fallback", redFlagSymptoms, otherSymptoms };
  }

  return undefined;
}

// =================== Red flag alert ===================

function selectRedFlagAlert(activeSymptoms: string[]): { symptomIds: string[]; labels: string[] } | undefined {
  if (!Array.isArray(activeSymptoms) || activeSymptoms.length === 0) return undefined;
  const flagged = SYMPTOM_CATALOG.filter((s) => s.redFlag && activeSymptoms.includes(s.id));
  if (flagged.length === 0) return undefined;
  return { symptomIds: flagged.map((s) => s.id), labels: flagged.map((s) => s.label) };
}

// =================== Public API ===================

export function ageFromBirthDate(birthDate: string | undefined): number | undefined {
  if (!birthDate) return undefined;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000));
}

export function selectSignals(input: {
  profile: Record<string, any>;
  biomarkers: BiomarkerRow[];
  dna: DnaInsightRow[];
}): SignalSet {
  const fh = (input.profile.familyHistory as FamilyHistory) ?? {};
  const activeSymptoms = (input.profile.activeSymptoms as string[]) ?? [];
  const sex = input.profile.sex === "Femme" ? "female" : input.profile.sex === "Homme" ? "male" : undefined;
  const a = ageFromBirthDate(input.profile.birthDate as string | undefined);

  return {
    card1: selectCard1(input.biomarkers, input.dna, fh),
    card2: selectCard2(input.dna, input.profile),
    card3: selectCard3(fh, a, sex, activeSymptoms),
    redFlagAlert: selectRedFlagAlert(activeSymptoms),
  };
}

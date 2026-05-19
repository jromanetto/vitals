/**
 * Unified recommendations engine — produces a single todo list combining:
 *  - Overdue / due screenings (from screening-catalog × user's profile)
 *  - Devices matched against symptoms / biomarkers / DNA / family / age / sex
 *  - Specialists to see based on the same triggers
 *  - Supplements to take if not yet in the active stack
 *  - Red-flag actions (immediate)
 *
 * Pure function, no LLM, no DB writes. Caller (the /api/todo route) handles
 * caching and persistence of todo state (done / snoozed).
 */
import { applicableScreenings, statusForScreening } from "@/lib/medical/screening-catalog";
import type { ScreeningEntry, ScreeningHistory, FamilyHistory } from "@/lib/medical/types";
import { SYMPTOM_CATALOG } from "@/lib/medical/symptom-catalog";
import { DEVICE_CATALOG, type Device, type DeviceTrigger } from "@/lib/medical/device-catalog";
import { SPECIALIST_CATALOG, type Specialist } from "@/lib/medical/specialist-catalog";
import { DISEASE_CATALOG } from "@/lib/medical/disease-catalog";

export type TodoItem = {
  id: string;
  kind: "red-flag" | "screening" | "device" | "specialist" | "supplement" | "lab-test";
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  category?: string;
  ctaLabel: string;
  ctaHref?: string;
  externalUrl?: string;
  meta?: Record<string, unknown>;
};

export type Profile = {
  birthDate?: string;
  sex?: string;
  goals?: string[];
  primaryGoals?: string[];
  activeSymptoms?: string[];
  noActiveSymptoms?: boolean;
  familyHistory?: FamilyHistory;
  screeningHistory?: ScreeningHistory;
  wearables?: string[];
  todoState?: Record<string, { status: "done" | "snoozed" | "dismissed"; until?: number }>;
} & Record<string, unknown>;

export type BiomarkerLatest = {
  slug: string;
  name: string;
  value: number;
  refLow?: number | null;
  refHigh?: number | null;
  optimalLow?: number | null;
  optimalHigh?: number | null;
};

export type DnaInsight = {
  rsid: string;
  category: string;
  hasRisk?: boolean;
  isProtective?: boolean;
};

export type SupplementSuggestion = {
  supplement: string;
  reason: string;
  dose: string;
  timing: string;
  priority: "high" | "moderate" | "info";
  coveredBy?: { id: number; name: string; nutrient: string } | null;
};

function ageFromBirthDate(b?: string): number | undefined {
  if (!b) return undefined;
  const d = new Date(b);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000));
}

function sexToken(s: string | undefined): "Homme" | "Femme" | undefined {
  if (s === "Homme" || s === "Femme") return s;
  return undefined;
}

// ──────────────────────────────────────────────────────────────────
// Trigger matching
// ──────────────────────────────────────────────────────────────────

function matchTrigger(
  trigger: DeviceTrigger,
  ctx: { profile: Profile; biomarkers: BiomarkerLatest[]; dna: DnaInsight[]; age?: number; sex?: "Homme" | "Femme" },
): { match: boolean; reason?: string } {
  const { profile, biomarkers, dna, age, sex } = ctx;
  if (trigger.kind === "symptom") {
    const active = new Set(profile.activeSymptoms ?? []);
    const hits = trigger.ids.filter((id) => active.has(id));
    const need = trigger.minMatch ?? 1;
    if (hits.length >= need) {
      const labels = hits.map((id) => SYMPTOM_CATALOG.find((s) => s.id === id)?.label ?? id);
      return { match: true, reason: `Symptômes : ${labels.join(", ")}` };
    }
    return { match: false };
  }
  if (trigger.kind === "biomarker") {
    const bm = biomarkers.find((b) => b.slug === trigger.slug);
    if (trigger.condition === "missing") {
      return { match: !bm, reason: bm ? undefined : `Biomarqueur ${trigger.slug} jamais mesuré` };
    }
    if (!bm) return { match: false };
    if (trigger.condition === "out_of_range") {
      const lo = bm.refLow ?? -Infinity;
      const hi = bm.refHigh ?? Infinity;
      const out = bm.value < lo || bm.value > hi;
      return { match: out, reason: out ? `${bm.name} = ${bm.value} (hors plage ${bm.refLow ?? "?"}-${bm.refHigh ?? "?"})` : undefined };
    }
    if (trigger.condition === "borderline") {
      const optLo = bm.optimalLow ?? bm.refLow;
      const optHi = bm.optimalHigh ?? bm.refHigh;
      const lo = bm.refLow ?? -Infinity;
      const hi = bm.refHigh ?? Infinity;
      const labIn = bm.value >= lo && bm.value <= hi;
      const optOut = (optLo != null && bm.value < optLo) || (optHi != null && bm.value > optHi);
      const matches = labIn && optOut;
      return { match: matches, reason: matches ? `${bm.name} = ${bm.value} dans la plage labo mais hors optimal` : undefined };
    }
    return { match: false };
  }
  if (trigger.kind === "dna") {
    const matches = dna.filter((d) => {
      if (trigger.rsids && trigger.rsids.includes(d.rsid) && d.hasRisk) return true;
      if (trigger.categories && trigger.categories.includes(d.category.toLowerCase()) && d.hasRisk) return true;
      return false;
    });
    if (matches.length > 0) {
      return { match: true, reason: `Variante génétique à risque : ${matches.map((m) => m.rsid).join(", ")}` };
    }
    return { match: false };
  }
  if (trigger.kind === "family") {
    const fh = profile.familyHistory ?? {};
    for (const [key, entry] of Object.entries(fh)) {
      if (entry?.status !== "yes") continue;
      const [, diseaseId] = key.split(".");
      if (trigger.diseaseIds.includes(diseaseId)) {
        const disease = DISEASE_CATALOG.find((d) => d.id === diseaseId);
        return { match: true, reason: `Antécédent familial : ${disease?.label ?? diseaseId}` };
      }
    }
    return { match: false };
  }
  if (trigger.kind === "age") {
    if (age === undefined) return { match: false };
    const minOk = trigger.min === undefined || age >= trigger.min;
    const maxOk = trigger.max === undefined || age <= trigger.max;
    return { match: minOk && maxOk };
  }
  if (trigger.kind === "sex") {
    return { match: sex === trigger.value };
  }
  if (trigger.kind === "goal") {
    const goals = new Set([
      ...((profile.primaryGoals as string[] | undefined) ?? []),
      ...((profile.goals as string[] | undefined) ?? []),
    ]);
    const hits = trigger.ids.filter((g) => goals.has(g));
    if (hits.length > 0) return { match: true, reason: `Objectif : ${hits.join(", ")}` };
    return { match: false };
  }
  if (trigger.kind === "no-wearable") {
    const w = profile.wearables ?? [];
    return { match: w.length === 0, reason: w.length === 0 ? "Pas encore de wearable" : undefined };
  }
  return { match: false };
}

function evaluateDevice(d: Device, ctx: Parameters<typeof matchTrigger>[1]): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const t of d.triggers) {
    const r = matchTrigger(t, ctx);
    if (r.match && r.reason) reasons.push(r.reason);
  }
  return { matches: reasons.length > 0, reasons };
}

function evaluateSpecialist(s: Specialist, ctx: Parameters<typeof matchTrigger>[1]): { matches: boolean; reasons: string[] } {
  // For specialists, ALL triggers must match (more conservative — don't surface gyneco-mammo to men).
  const reasons: string[] = [];
  for (const t of s.triggers) {
    const r = matchTrigger(t, ctx);
    if (!r.match) return { matches: false, reasons: [] };
    if (r.reason) reasons.push(r.reason);
  }
  return { matches: true, reasons };
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

export function computeTodo(input: {
  profile: Profile;
  biomarkers: BiomarkerLatest[];
  dna: DnaInsight[];
  supplements: SupplementSuggestion[]; // from /api/supplements/suggestions
}): TodoItem[] {
  const age = ageFromBirthDate(input.profile.birthDate);
  const sex = sexToken(input.profile.sex);
  const ctx = { profile: input.profile, biomarkers: input.biomarkers, dna: input.dna, age, sex };
  const items: TodoItem[] = [];

  // 1) Red-flag immediate actions from symptoms
  const activeSymptoms = input.profile.activeSymptoms ?? [];
  for (const id of activeSymptoms) {
    const s = SYMPTOM_CATALOG.find((x) => x.id === id);
    if (!s?.redFlag) continue;
    items.push({
      id: `red-flag:${id}`,
      kind: "red-flag",
      title: `À discuter rapidement : ${s.label}`,
      rationale: "Symptôme nécessitant un avis médical sans délai. Prends rendez-vous avec ton médecin traitant cette semaine.",
      priority: "high",
      ctaLabel: "Prendre RDV",
      ctaHref: "/data/profile?tab=symptomes",
    });
  }

  // 2) Screenings — overdue (high) / due (medium) / upcoming (low if within 6 months of age threshold)
  const applicable: ScreeningEntry[] = applicableScreenings(age, sex === "Homme" ? "male" : sex === "Femme" ? "female" : undefined);
  for (const screening of applicable) {
    const status = statusForScreening(
      screening,
      input.profile.screeningHistory ?? {},
      age,
      sex === "Homme" ? "male" : sex === "Femme" ? "female" : undefined,
    );
    if (status === "na" || status === "done") continue;
    const priority: TodoItem["priority"] = status === "overdue" ? "high" : status === "due" ? "medium" : "low";
    const label =
      status === "overdue" ? "En retard" :
      status === "due" ? "À programmer" :
      "À anticiper";

    // Family-amplified screening — bump priority + earlier age recommendation
    const familyAmplifier = familyAmplifies(screening, input.profile.familyHistory ?? {});
    items.push({
      id: `screening:${screening.id}`,
      kind: "screening",
      title: `${label} : ${screening.label}`,
      rationale: familyAmplifier
        ? `${familyAmplifier} — recommandé à un âge plus précoce que la cohorte standard.`
        : `Cadence recommandée : tous les ${screening.cadence === "once" ? "—" : screening.cadence.replace("y", " an(s)")}.`,
      priority: familyAmplifier ? "high" : priority,
      category: "Examen",
      ctaLabel: "Marquer comme fait",
      ctaHref: "/data/profile?tab=screening",
    });
  }

  // 3) Devices
  for (const d of DEVICE_CATALOG) {
    const ev = evaluateDevice(d, ctx);
    if (!ev.matches) continue;
    items.push({
      id: `device:${d.id}`,
      kind: "device",
      title: `${d.name} (${d.brand})`,
      rationale: `${d.rationaleTemplate} · ${ev.reasons.slice(0, 2).join(" · ")}`,
      priority: "medium",
      category: d.category,
      ctaLabel: `Voir (${d.priceEur})`,
      externalUrl: d.url,
    });
  }

  // 4) Specialists
  for (const s of SPECIALIST_CATALOG) {
    const ev = evaluateSpecialist(s, ctx);
    if (!ev.matches) continue;
    items.push({
      id: `specialist:${s.id}`,
      kind: "specialist",
      title: s.title,
      rationale: `${s.rationale}${ev.reasons.length ? " · " + ev.reasons.slice(0, 2).join(" · ") : ""}`,
      priority: "medium",
      category: "Consultation",
      ctaLabel: "Programmer",
    });
  }

  // 5) Supplements not yet in the active stack
  for (const sup of input.supplements) {
    if (sup.coveredBy) continue; // already taken
    items.push({
      id: `supplement:${sup.supplement.toLowerCase().replace(/\s+/g, "-")}`,
      kind: "supplement",
      title: `Ajouter : ${sup.supplement}`,
      rationale: `${sup.reason} · ${sup.dose}, ${sup.timing}`,
      priority: sup.priority === "high" ? "high" : sup.priority === "moderate" ? "medium" : "low",
      category: "Complément",
      ctaLabel: "Ajouter à ma stack",
      ctaHref: "/stack?tab=supplements",
    });
  }

  // Filter out items the user has marked done / snoozed
  const todoState = input.profile.todoState ?? {};
  const now = Date.now();
  const filtered = items.filter((it) => {
    const state = todoState[it.id];
    if (!state) return true;
    if (state.status === "done" || state.status === "dismissed") return false;
    if (state.status === "snoozed") return !state.until || state.until <= now;
    return true;
  });

  // Sort: red-flag > screening high > others by priority
  const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const kindWeight: Record<string, number> = { "red-flag": 0, screening: 1, specialist: 2, device: 3, supplement: 4, "lab-test": 5 };
  filtered.sort((a, b) => {
    const dp = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (dp !== 0) return dp;
    return kindWeight[a.kind] - kindWeight[b.kind];
  });

  return filtered;
}

function familyAmplifies(screening: ScreeningEntry, fh: FamilyHistory): string | null {
  // Map screening → relevant family diseases that justify earlier or more frequent screening.
  const map: Record<string, string[]> = {
    colonoscopy: ["cancer_colon"],
    fobt: ["cancer_colon"],
    mammography: ["cancer_breast", "cancer_ovary"],
    pap_smear: ["cancer_uterus"],
    psa: ["cancer_prostate"],
    dexa: ["osteoporosis", "hip_fracture"],
    ecg: ["mi", "afib", "sudden_death"],
    echo_heart: ["mi", "sudden_death"],
    stress_test: ["mi", "stroke"],
    abdo_us: ["aneurysm"],
  };
  const relevant = map[screening.id];
  if (!relevant) return null;
  for (const [key, entry] of Object.entries(fh)) {
    if (entry?.status !== "yes") continue;
    const [, diseaseId] = key.split(".");
    if (relevant.includes(diseaseId)) {
      const disease = DISEASE_CATALOG.find((d) => d.id === diseaseId);
      const ageBit = entry.ageOfDiagnosis ? ` à ${entry.ageOfDiagnosis} ans` : "";
      return `ATCD familial ${disease?.label ?? diseaseId}${ageBit}`;
    }
  }
  return null;
}

// Mapping biomarker slugs and DNA categories to body systems for human-friendly grouping.
// Used by the biomarkers and DNA pages to organize data by physiological system.

export type BodySystem = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  pillar?: "sommeil" | "sport" | "nutrition" | "stress";
};

export const BODY_SYSTEMS: BodySystem[] = [
  { id: "heart",       label: "Cœur & vaisseaux",  emoji: "🫀", description: "Cholestérol, lipoprotéines, inflammation cardio" },
  { id: "metabolism",  label: "Métabolisme",       emoji: "🔥", description: "Glycémie, insulino-résistance, énergie", pillar: "nutrition" },
  { id: "thyroid",     label: "Thyroïde",          emoji: "🦋", description: "TSH, T3/T4, axe hypophyso-thyroïdien" },
  { id: "hormones",    label: "Hormones",          emoji: "⚗️", description: "Testostérone, œstrogènes, cortisol, DHEA, IGF-1" },
  { id: "liver",       label: "Foie",              emoji: "🩻", description: "Enzymes hépatiques, métabolisme phase I/II" },
  { id: "kidneys",     label: "Reins",             emoji: "🫘", description: "Créatinine, urée, filtration glomérulaire" },
  { id: "blood",       label: "Sang & globules",   emoji: "🩸", description: "NFS, hémoglobine, plaquettes" },
  { id: "iron",        label: "Fer",               emoji: "⛓️",  description: "Ferritine, transferrine, saturation" },
  { id: "vitamins",    label: "Vitamines",         emoji: "💊", description: "D, B12, B9, méthylation", pillar: "nutrition" },
  { id: "minerals",    label: "Minéraux",          emoji: "🪨", description: "Mg, Zn, Se, Cu, Ca, K", pillar: "nutrition" },
  { id: "inflammation",label: "Inflammation",      emoji: "🔥", description: "hsCRP, VS, ferritine inflammatoire" },
  { id: "brain",       label: "Cerveau",           emoji: "🧠", description: "Cognition, neurotransmetteurs, sommeil", pillar: "sommeil" },
  { id: "muscle",      label: "Muscle & sport",    emoji: "💪", description: "CPK, performance, récupération", pillar: "sport" },
  { id: "immune",      label: "Immunité",          emoji: "🛡️",  description: "HLA, auto-immunité, allergies" },
  { id: "detox",       label: "Détoxification",    emoji: "🌿", description: "GST, CYP, méthylation phase II" },
  { id: "longevity",   label: "Longévité",         emoji: "♾️",  description: "FOXO3, APOE, sénescence, télomères" },
  { id: "fitness",     label: "Performance",       emoji: "🏃", description: "ACTN3, VO2max, type fibres", pillar: "sport" },
  { id: "skin-vision", label: "Peau & vision",     emoji: "👁️",  description: "Lutéine, lycopène, hyaluronique" },
  { id: "other",       label: "Autres",            emoji: "•",  description: "Marqueurs non classés" },
];

export const SYSTEM_BY_ID: Record<string, BodySystem> = Object.fromEntries(BODY_SYSTEMS.map((s) => [s.id, s]));

// Biomarker slug → body system. Patterns are tested in order (first match wins).
const BIOMARKER_RULES: Array<{ pattern: RegExp; system: string }> = [
  { pattern: /^(cholesterol|ldl|hdl|trigly|apo-b|apo-a|lp-a|index-omega|non-hdl)/i, system: "heart" },
  { pattern: /^(glycemie|hba1c|insuline|homa|leptine|adiponectine|fructosamine)/i, system: "metabolism" },
  { pattern: /^(tsh|t3|t4|anti-tpo|anti-tg|tg-thyro)/i, system: "thyroid" },
  { pattern: /^(testosterone|shbg|oestradiol|estradiol|dhea|igf-1|cortisol|progester|fsh|lh|prolactine)/i, system: "hormones" },
  { pattern: /^(alat|asat|ggt|gamma|bilirubin|phosphatase-alc|alpha-foeto)/i, system: "liver" },
  { pattern: /^(creatinine|uree|egfr|cystatine|microalbumin|protein-uria)/i, system: "kidneys" },
  { pattern: /^(hemoglobine|hematocrite|globules|leuco|lymph|neutro|eosin|baso|monocyte|plaquette|vgm|tcmh|ccmh|reticul)/i, system: "blood" },
  { pattern: /^(ferritine|fer-serique|transferrine|saturation-transferrine|tibc|hepcidine)/i, system: "iron" },
  { pattern: /^(vitamine-d|vitamine-b12|holotranscobalamine|folates|b9|vitamine-b6|vitamine-a|vitamine-e|vitamine-c|vitamine-k|biotine|niacine|panto)/i, system: "vitamins" },
  { pattern: /^(magnesium|zinc|selenium|cuivre|chrome|manganese|iode|calcium|phosphor|potassium|sodium|bore)/i, system: "minerals" },
  { pattern: /^(crp|hscrp|vs|fibrinog|il-6|tnf|d-dimer|homocysteine)/i, system: "inflammation" },
  { pattern: /^(cpk|ck-mb|myoglob|aldolase|troponine)/i, system: "muscle" },
  { pattern: /^(albumin|protein|prealbumin)/i, system: "blood" },
  { pattern: /^(pth|parathormone)/i, system: "minerals" },
];

export function biomarkerSystem(slug: string): string {
  const s = (slug || "").toLowerCase();
  for (const rule of BIOMARKER_RULES) if (rule.pattern.test(s)) return rule.system;
  return "other";
}

// DNA category → body system
const DNA_TO_SYSTEM: Record<string, string> = {
  cardiovascular: "heart",
  metabolism: "metabolism",
  longevity: "longevity",
  nutrition: "vitamins",
  fitness: "fitness",
  cognitive: "brain",
  hormones: "hormones",
  immunity: "immune",
  detox: "detox",
  carriers: "other",
};

export function dnaSystem(category: string): string {
  return DNA_TO_SYSTEM[category] ?? "other";
}

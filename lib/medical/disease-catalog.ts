import type { DiseaseEntry, DiseaseCategory } from "./types";

// Catalog of ~50 hereditary-relevant conditions, with heritability estimates from
// twin/GWAS literature (rounded). Used in the family-history grid + risk scoring.
export const DISEASE_CATALOG: DiseaseEntry[] = [
  // === Cardio ===
  { id: "mi", label: "Infarctus du myocarde", category: "cardio", heritability: 0.4, icd10: "I21" },
  { id: "stroke", label: "AVC", category: "cardio", heritability: 0.4, icd10: "I63" },
  { id: "htn", label: "Hypertension artérielle", category: "cardio", heritability: 0.5, icd10: "I10" },
  { id: "afib", label: "Fibrillation auriculaire", category: "cardio", heritability: 0.4, icd10: "I48" },
  { id: "aneurysm", label: "Anévrisme aortique", category: "cardio", heritability: 0.5, icd10: "I71" },
  { id: "sudden_death", label: "Mort subite cardiaque", category: "cardio", heritability: 0.5 },
  { id: "hf", label: "Insuffisance cardiaque", category: "cardio", heritability: 0.3, icd10: "I50" },

  // === Métabolique ===
  { id: "t1d", label: "Diabète type 1", category: "metabolic", heritability: 0.5, icd10: "E10" },
  { id: "t2d", label: "Diabète type 2", category: "metabolic", heritability: 0.6, icd10: "E11" },
  { id: "obesity", label: "Obésité morbide", category: "metabolic", heritability: 0.7, icd10: "E66" },
  { id: "fh_chol", label: "Hypercholestérolémie familiale", category: "metabolic", heritability: 0.9, icd10: "E78.01" },
  { id: "metsyn", label: "Syndrome métabolique", category: "metabolic", heritability: 0.4 },
  { id: "thyroid_hypo", label: "Hypothyroïdie", category: "metabolic", heritability: 0.5, icd10: "E03" },
  { id: "hashimoto", label: "Hashimoto", category: "autoimmune", heritability: 0.6, icd10: "E06.3" },

  // === Cancers ===
  { id: "cancer_breast", label: "Cancer du sein", category: "cancer", heritability: 0.3 },
  { id: "cancer_prostate", label: "Cancer de la prostate", category: "cancer", heritability: 0.4 },
  { id: "cancer_colon", label: "Cancer colorectal", category: "cancer", heritability: 0.3 },
  { id: "cancer_lung", label: "Cancer du poumon", category: "cancer", heritability: 0.2 },
  { id: "cancer_pancreas", label: "Cancer du pancréas", category: "cancer", heritability: 0.3 },
  { id: "cancer_ovary", label: "Cancer de l'ovaire", category: "cancer", heritability: 0.4 },
  { id: "cancer_uterus", label: "Cancer de l'utérus / endomètre", category: "cancer", heritability: 0.3 },
  { id: "melanoma", label: "Mélanome", category: "cancer", heritability: 0.3 },
  { id: "leukemia", label: "Leucémie / lymphome", category: "cancer", heritability: 0.2 },
  { id: "cancer_other", label: "Autre cancer", category: "cancer", heritability: 0.2 },

  // === Neuro ===
  { id: "alzheimer", label: "Alzheimer", category: "neuro", heritability: 0.7 },
  { id: "parkinson", label: "Parkinson", category: "neuro", heritability: 0.3 },
  { id: "ms", label: "Sclérose en plaques", category: "neuro", heritability: 0.3 },
  { id: "als", label: "SLA (Charcot)", category: "neuro", heritability: 0.6 },
  { id: "dementia_other", label: "Démence (autre)", category: "neuro", heritability: 0.4 },
  { id: "huntington", label: "Huntington", category: "neuro", heritability: 1.0 },
  { id: "epilepsy", label: "Épilepsie", category: "neuro", heritability: 0.5, icd10: "G40" },

  // === Auto-immune ===
  { id: "crohn", label: "Maladie de Crohn", category: "autoimmune", heritability: 0.5 },
  { id: "uc", label: "Rectocolite hémorragique", category: "autoimmune", heritability: 0.4 },
  { id: "lupus", label: "Lupus", category: "autoimmune", heritability: 0.4 },
  { id: "ra", label: "Polyarthrite rhumatoïde", category: "autoimmune", heritability: 0.5 },
  { id: "psoriasis", label: "Psoriasis", category: "autoimmune", heritability: 0.7 },
  { id: "celiac", label: "Maladie cœliaque", category: "autoimmune", heritability: 0.7 },

  // === Psy ===
  { id: "depression", label: "Dépression majeure", category: "psy", heritability: 0.4 },
  { id: "bipolar", label: "Trouble bipolaire", category: "psy", heritability: 0.7 },
  { id: "schizo", label: "Schizophrénie", category: "psy", heritability: 0.8 },
  { id: "suicide", label: "Suicide", category: "psy", heritability: 0.4 },
  { id: "addiction", label: "Addictions sévères", category: "psy", heritability: 0.5 },

  // === Hématologique ===
  { id: "thrombosis", label: "Thrombose / embolie pulmonaire", category: "hema", heritability: 0.6 },
  { id: "hemophilia", label: "Hémophilie", category: "hema", heritability: 1.0 },
  { id: "sickle", label: "Drépanocytose / thalassémie", category: "hema", heritability: 1.0 },

  // === Rénal ===
  { id: "ckd", label: "Insuffisance rénale chronique", category: "renal", heritability: 0.4 },
  { id: "pkd", label: "Polykystose rénale", category: "renal", heritability: 0.9 },

  // === Hépatique ===
  { id: "cirrhosis", label: "Cirrhose", category: "hepatic", heritability: 0.3 },
  { id: "hemochromatosis", label: "Hémochromatose", category: "hepatic", heritability: 0.9, icd10: "E83.110" },

  // === ORL / oculaire ===
  { id: "amd", label: "DMLA", category: "ent_eye", heritability: 0.7 },
  { id: "glaucoma", label: "Glaucome", category: "ent_eye", heritability: 0.5 },
  { id: "deafness", label: "Surdité héréditaire", category: "ent_eye", heritability: 0.7 },

  // === Bone ===
  { id: "osteoporosis", label: "Ostéoporose", category: "bone", heritability: 0.6 },
  { id: "hip_fracture", label: "Fracture col du fémur", category: "bone", heritability: 0.5 },
];

export const CATEGORY_LABELS_FR: Record<DiseaseCategory, string> = {
  cardio: "Cardio-vasculaire",
  metabolic: "Métabolique / endocrinien",
  cancer: "Cancers",
  neuro: "Neurologique",
  autoimmune: "Auto-immune",
  psy: "Santé mentale",
  hema: "Hématologique",
  renal: "Rénal",
  hepatic: "Hépatique",
  ent_eye: "Vue / audition",
  bone: "Os / articulations",
};

export const CATEGORY_ORDER: DiseaseCategory[] = [
  "cardio",
  "metabolic",
  "cancer",
  "neuro",
  "autoimmune",
  "psy",
  "hema",
  "renal",
  "hepatic",
  "ent_eye",
  "bone",
];

export function diseasesByCategory(): Record<DiseaseCategory, DiseaseEntry[]> {
  const out = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, [] as DiseaseEntry[]])) as Record<DiseaseCategory, DiseaseEntry[]>;
  for (const d of DISEASE_CATALOG) out[d.category].push(d);
  return out;
}

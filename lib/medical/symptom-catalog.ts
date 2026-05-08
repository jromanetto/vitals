import type { SymptomEntry, SymptomCategory } from "./types";

// Active symptom check-list shown during onboarding & on demand.
// Red-flag items get a visual marker and a "à discuter avec un médecin" hint.
export const SYMPTOM_CATALOG: SymptomEntry[] = [
  // === General ===
  { id: "fatigue", label: "Fatigue persistante", category: "general" },
  { id: "weight_change", label: "Variation de poids inexpliquée", category: "general", redFlag: true },
  { id: "night_sweats", label: "Sueurs nocturnes", category: "general", redFlag: true },
  { id: "fever_recurrent", label: "Fièvres récurrentes", category: "general", redFlag: true },

  // === Cardio ===
  { id: "palpitations", label: "Palpitations", category: "cardio" },
  { id: "chest_pain", label: "Douleur thoracique à l'effort", category: "cardio", redFlag: true },
  { id: "shortness_breath", label: "Essoufflement à l'effort", category: "cardio" },
  { id: "edema", label: "Œdèmes des jambes", category: "cardio" },

  // === Neuro ===
  { id: "headaches", label: "Maux de tête fréquents", category: "neuro" },
  { id: "dizziness", label: "Vertiges", category: "neuro" },
  { id: "tingling", label: "Fourmillements / engourdissements", category: "neuro" },
  { id: "memory_loss", label: "Pertes de mémoire", category: "neuro", redFlag: true },
  { id: "brain_fog", label: "Brouillard mental", category: "neuro" },
  { id: "tremor", label: "Tremblements", category: "neuro", redFlag: true },

  // === Digestive ===
  { id: "bloating", label: "Ballonnements", category: "digestive" },
  { id: "reflux", label: "Reflux / brûlures", category: "digestive" },
  { id: "constipation", label: "Constipation", category: "digestive" },
  { id: "diarrhea", label: "Diarrhée chronique", category: "digestive" },
  { id: "blood_stool", label: "Sang dans les selles", category: "digestive", redFlag: true },
  { id: "nausea", label: "Nausées", category: "digestive" },

  // === Musculoskeletal ===
  { id: "joint_pain", label: "Douleurs articulaires", category: "musculoskeletal" },
  { id: "back_pain", label: "Mal de dos chronique", category: "musculoskeletal" },
  { id: "muscle_weakness", label: "Faiblesse musculaire", category: "musculoskeletal" },
  { id: "morning_stiffness", label: "Raideurs matinales", category: "musculoskeletal" },

  // === Skin ===
  { id: "rash", label: "Éruption / démangeaisons", category: "skin" },
  { id: "hair_loss", label: "Chute de cheveux", category: "skin" },
  { id: "new_mole", label: "Grain de beauté qui change", category: "skin", redFlag: true },

  // === Respiratory ===
  { id: "cough", label: "Toux persistante", category: "respiratory", redFlag: true },
  { id: "snoring", label: "Ronflement / apnée suspectée", category: "respiratory" },

  // === Urogenital ===
  { id: "urination_freq", label: "Mictions fréquentes / nocturnes", category: "urogenital" },
  { id: "low_libido", label: "Baisse de libido", category: "urogenital" },
  { id: "erectile", label: "Troubles de l'érection", category: "urogenital" },

  // === Mental ===
  { id: "anxiety", label: "Anxiété", category: "mental" },
  { id: "low_mood", label: "Humeur basse / dépressive", category: "mental" },
  { id: "insomnia", label: "Insomnies", category: "mental" },
  { id: "irritability", label: "Irritabilité", category: "mental" },

  // === Metabolic ===
  { id: "thirst", label: "Soif inhabituelle", category: "metabolic", redFlag: true },
  { id: "cold_sensitivity", label: "Sensibilité au froid", category: "metabolic" },
  { id: "heat_sensitivity", label: "Sensibilité à la chaleur", category: "metabolic" },
];

export const SYMPTOM_CATEGORY_LABELS_FR: Record<SymptomCategory, string> = {
  general: "Général",
  cardio: "Cardio-vasculaire",
  neuro: "Neuro",
  digestive: "Digestif",
  musculoskeletal: "Articulations / muscles",
  skin: "Peau",
  respiratory: "Respiratoire",
  urogenital: "Uro / sexualité",
  mental: "Santé mentale",
  metabolic: "Métabolique",
};

export const SYMPTOM_CATEGORY_ORDER: SymptomCategory[] = [
  "general",
  "mental",
  "cardio",
  "neuro",
  "digestive",
  "musculoskeletal",
  "skin",
  "respiratory",
  "urogenital",
  "metabolic",
];

export function symptomsByCategory(): Record<SymptomCategory, SymptomEntry[]> {
  const out = Object.fromEntries(SYMPTOM_CATEGORY_ORDER.map((c) => [c, [] as SymptomEntry[]])) as Record<SymptomCategory, SymptomEntry[]>;
  for (const s of SYMPTOM_CATALOG) out[s.category].push(s);
  return out;
}

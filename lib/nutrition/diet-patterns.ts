import type { DietPattern } from "./types";

export const DIET_PATTERNS: DietPattern[] = [
  {
    key: "mediterranean",
    label: "Méditerranéen",
    description: "Légumes, légumineuses, poissons gras, huile d'olive, fruits, grains complets, peu de viande rouge. Référence longévité (étude PREDIMED, Blue Zones).",
    macros: { protein: "1.0–1.4 g/kg", carbs: "40–50%", fat: "35–40%" },
    triggers: ["default", "ldl-high", "crp-elevated", "longevity-focus"],
  },
  {
    key: "mediterranean-low-carb",
    label: "Méditerranéen low-carb",
    description: "Variante méditerranéenne avec glucides réduits (≤100g/j). Optimal pour résistance à l'insuline ou HOMA-IR élevé.",
    macros: { protein: "1.4–1.8 g/kg", carbs: "20–30%", fat: "45–55%" },
    triggers: ["hba1c-elevated", "insulin-resistance", "tg-high"],
  },
  {
    key: "mind",
    label: "MIND (Mediterranean-DASH Intervention)",
    description: "Croisement méditerranéen + DASH ciblé cognition. Baies + légumes verts + poissons gras 2x/sem. Études Rush University → -53% Alzheimer.",
    macros: { protein: "1.0–1.4 g/kg", carbs: "40–50%", fat: "35–40%" },
    triggers: ["apoe4", "cognitive-focus", "homocysteine-high"],
  },
  {
    key: "dash",
    label: "DASH (Dietary Approaches to Stop Hypertension)",
    description: "Légumes, fruits, laitages écrémés, grains complets. Sodium <2.3g/j. Validé pour hypertension et néphroprotection.",
    macros: { protein: "1.0–1.4 g/kg", carbs: "50–55%", fat: "27%" },
    triggers: ["hypertension", "creatinine-elevated", "potassium-low"],
  },
  {
    key: "low-fodmap",
    label: "Low FODMAP",
    description: "Élimination temporaire des glucides fermentescibles pour SII / inflammation digestive. Phase d'élimination 4-6 semaines puis réintroduction.",
    macros: { protein: "1.2–1.6 g/kg", carbs: "30–40%", fat: "35–45%" },
    triggers: ["gut-symptoms", "ibs"],
  },
  {
    key: "anti-inflammatory",
    label: "Anti-inflammatoire",
    description: "Maximalise oméga-3, polyphénols, légumes crucifères, curcuma, gingembre. Élimine huiles industrielles, sucre, ultra-transformé.",
    macros: { protein: "1.2–1.6 g/kg", carbs: "30–40%", fat: "40–50%" },
    triggers: ["crp-elevated", "autoimmune", "joint-pain"],
  },
  {
    key: "ketogenic",
    label: "Cétogène stricte",
    description: "Glucides <30g/j, induction de cétose nutritionnelle. Indiqué pour épilepsie réfractaire, certains cancers, insulinorésistance sévère. Surveillance médicale.",
    macros: { protein: "1.6–2.0 g/kg", carbs: "<5%", fat: "70–80%" },
    triggers: ["severe-insulin-resistance", "user-pref-keto"],
  },
  {
    key: "pescatarian",
    label: "Pescatarien",
    description: "Végétarien + poissons et fruits de mer. Bonne couverture oméga-3, B12, iode sans viande terrestre.",
    macros: { protein: "1.0–1.4 g/kg", carbs: "40–50%", fat: "35–40%" },
    triggers: ["user-pref-pescatarian"],
  },
  {
    key: "plant-based-balanced",
    label: "Végétal équilibré",
    description: "Végétarien/végan structuré avec légumineuses, céréales complètes, noix, supplémentation B12 + D3 + oméga-3 (EPA/DHA algue).",
    macros: { protein: "1.2–1.6 g/kg", carbs: "45–55%", fat: "30–35%" },
    triggers: ["user-pref-vegetarian", "user-pref-vegan"],
  },
  {
    key: "carnivore",
    label: "Carnivore",
    description: "Animal exclusif (viande, poisson, œufs, parfois laitages). Approche élimination radicale, indication ciblée auto-immune réfractaire. Surveillance lipides + reins.",
    macros: { protein: "1.6–2.4 g/kg", carbs: "<2%", fat: "70–80%" },
    triggers: ["user-pref-carnivore"],
  },
];

export const PATTERN_BY_KEY: Record<string, DietPattern> = Object.fromEntries(DIET_PATTERNS.map((p) => [p.key, p]));

/**
 * Curated catalog of health devices / lab tests / wellness products that
 * Vitals can recommend based on the patient's profile, biomarkers, DNA and
 * symptoms.
 *
 * Pure data, no runtime dependencies. The recommendations engine matches
 * triggers against the profile and produces a deduplicated todo list.
 *
 * Links point to the official product or brand page — no affiliate, no
 * tracking parameters. EU availability noted where relevant.
 */

export type DeviceCategory =
  | "sleep"
  | "glucose"
  | "blood-pressure"
  | "wearable"
  | "body-composition"
  | "lab-panel"
  | "imaging"
  | "respiration"
  | "thermal";

export type Device = {
  id: string;
  name: string;
  brand: string;
  category: DeviceCategory;
  priceEur: string;          // approximate price range in € (or unit price)
  url: string;
  rationaleTemplate: string; // template explanation, can include {trigger} placeholder
  triggers: DeviceTrigger[]; // OR-combined: any matching trigger surfaces the device
  euAvailable: boolean;
};

export type DeviceTrigger =
  | { kind: "symptom"; ids: string[]; minMatch?: number } // minMatch=1 default
  | { kind: "biomarker"; slug: string; condition: "out_of_range" | "borderline" | "missing" }
  | { kind: "dna"; rsids?: string[]; categories?: string[]; protectiveOk?: boolean }
  | { kind: "family"; diseaseIds: string[] }
  | { kind: "age"; min?: number; max?: number }
  | { kind: "sex"; value: "Homme" | "Femme" }
  | { kind: "goal"; ids: string[] }
  | { kind: "no-wearable" };

export const DEVICE_CATALOG: Device[] = [
  // === Sleep & breathing ===
  {
    id: "sunrise",
    name: "Sunrise",
    brand: "Sunrise",
    category: "sleep",
    priceEur: "349€ (achat) / 89€ (location 1 mois)",
    url: "https://sunrise.bio",
    rationaleTemplate:
      "Capteur mâchoire à porter 7 nuits pour détecter les événements respiratoires liés à une possible apnée légère. Précision ~85% vs polysomnographie.",
    triggers: [
      { kind: "symptom", ids: ["snoring", "fatigue", "brain_fog"], minMatch: 2 },
    ],
    euAvailable: true,
  },
  {
    id: "withings-sleep-analyzer",
    name: "Sleep Analyzer",
    brand: "Withings",
    category: "sleep",
    priceEur: "129€",
    url: "https://www.withings.com/fr/fr/sleep-analyzer",
    rationaleTemplate:
      "Bandeau sous-matelas qui détecte l'apnée du sommeil (validé CE médical) + score sommeil nocturne. Pas d'effort à porter.",
    triggers: [
      { kind: "symptom", ids: ["snoring"] },
    ],
    euAvailable: true,
  },
  {
    id: "hello-sunshine",
    name: "Lampe luminothérapie",
    brand: "Lumie / Beurer",
    category: "sleep",
    priceEur: "60-150€",
    url: "https://www.lumie.com/fr",
    rationaleTemplate:
      "Lampe 10 000 lux pour resyncroniser le rythme circadien : réveil progressif + exposition lumineuse matinale. Utile si insomnies / brouillard mental / saisonnier.",
    triggers: [
      { kind: "symptom", ids: ["insomnia", "low_mood", "brain_fog"], minMatch: 1 },
    ],
    euAvailable: true,
  },
  {
    id: "eight-sleep-pod",
    name: "Pod 4 Ultra",
    brand: "Eight Sleep",
    category: "sleep",
    priceEur: "2 195€+",
    url: "https://www.eightsleep.com/fr",
    rationaleTemplate:
      "Surmatelas avec contrôle température + tracking sommeil profond. Investissement haut de gamme — peut améliorer sommeil profond +20% selon études.",
    triggers: [
      { kind: "goal", ids: ["Meilleur sommeil"] },
      { kind: "symptom", ids: ["insomnia"] },
    ],
    euAvailable: true,
  },

  // === Glucose ===
  {
    id: "dexcom-stelo",
    name: "Stelo (CGM 15 jours)",
    brand: "Dexcom",
    category: "glucose",
    priceEur: "~99€ / capteur (14 jours)",
    url: "https://www.dexcom.com/fr-fr/stelo",
    rationaleTemplate:
      "Capteur glucose continu 14 jours pour mapper tes pics post-prandiaux et identifier les aliments qui te font crasher. Idéal premier essai biohacker.",
    triggers: [
      { kind: "dna", rsids: ["rs7903146"] }, // TCF7L2
      { kind: "biomarker", slug: "hba1c", condition: "borderline" },
      { kind: "symptom", ids: ["fatigue"], minMatch: 1 },
      { kind: "goal", ids: ["Énergie", "Perte de poids"] },
    ],
    euAvailable: true,
  },
  {
    id: "abbott-lingo",
    name: "Lingo",
    brand: "Abbott",
    category: "glucose",
    priceEur: "89€ / capteur (14 jours)",
    url: "https://www.hellolingo.com",
    rationaleTemplate:
      "CGM grand public optimisé wellness : score métabolique + coaching alimentaire intégré. Plus accessible que Stelo médical.",
    triggers: [
      { kind: "biomarker", slug: "glucose", condition: "borderline" },
      { kind: "goal", ids: ["Optimisation cognitive", "Perte de poids"] },
    ],
    euAvailable: true,
  },

  // === Blood pressure ===
  {
    id: "withings-bpm-core",
    name: "BPM Core",
    brand: "Withings",
    category: "blood-pressure",
    priceEur: "229€",
    url: "https://www.withings.com/fr/fr/bpm-core",
    rationaleTemplate:
      "Tensiomètre + ECG + stéthoscope numérique en 1 device. Si ATCD familial cardio précoce, monitoring TA hebdo + détection arythmie.",
    triggers: [
      { kind: "family", diseaseIds: ["htn", "mi", "afib", "stroke"] },
      { kind: "biomarker", slug: "ldl", condition: "borderline" },
      { kind: "age", min: 45 },
    ],
    euAvailable: true,
  },

  // === Body composition ===
  {
    id: "withings-body-scan",
    name: "Body Scan",
    brand: "Withings",
    category: "body-composition",
    priceEur: "399€",
    url: "https://www.withings.com/fr/fr/body-scan",
    rationaleTemplate:
      "Balance avec ECG + impédancemétrie segmentaire (4 membres séparément) + score nerveux + indice vasculaire. Suivi composition corporelle précis.",
    triggers: [
      { kind: "goal", ids: ["Perte de masse grasse", "Prise de muscle", "Performance physique"] },
    ],
    euAvailable: true,
  },
  {
    id: "dexa-scan-bodyspec",
    name: "DEXA scan (en clinique)",
    brand: "Diverses cliniques radio",
    category: "imaging",
    priceEur: "120-200€ par scan",
    url: "https://www.google.com/search?q=DEXA+scan+composition+corporelle+France",
    rationaleTemplate:
      "Référence absolue pour densité osseuse + composition corporelle. Annuel après 50, ou tous les 3 ans si ATCD familial ostéoporose.",
    triggers: [
      { kind: "family", diseaseIds: ["osteoporosis", "hip_fracture"] },
      { kind: "age", min: 50 },
    ],
    euAvailable: true,
  },

  // === Wearables (only if no wearable yet) ===
  {
    id: "oura-ring",
    name: "Oura Ring 4",
    brand: "Oura",
    category: "wearable",
    priceEur: "399€ + abo 6€/mois",
    url: "https://ouraring.com",
    rationaleTemplate:
      "Bague qui track HRV, température, sommeil profond, REM, readiness. La référence biohacker — données précises sans poignet.",
    triggers: [
      { kind: "no-wearable" },
      { kind: "goal", ids: ["Longévité", "Optimisation cognitive"] },
    ],
    euAvailable: true,
  },
  {
    id: "whoop-5",
    name: "Whoop 5.0",
    brand: "Whoop",
    category: "wearable",
    priceEur: "30€/mois (abo, device inclus)",
    url: "https://www.whoop.com/fr",
    rationaleTemplate:
      "Bracelet sans écran, idéal sportifs intense : strain + recovery + sleep stages. Modèle abonnement (pas d'achat one-shot).",
    triggers: [
      { kind: "no-wearable" },
      { kind: "goal", ids: ["Performance physique"] },
    ],
    euAvailable: true,
  },

  // === Lab panels ===
  {
    id: "coronary-calcium-score",
    name: "Score calcique coronarien (CAC)",
    brand: "Centre radiologique",
    category: "imaging",
    priceEur: "150-250€ (souvent non remboursé)",
    url: "https://www.google.com/search?q=score+calcique+coronarien+France",
    rationaleTemplate:
      "Scanner thoracique low-dose qui mesure les plaques calcifiées coronariennes. À envisager si LDL borderline + ATCD familial cardio précoce.",
    triggers: [
      { kind: "family", diseaseIds: ["mi", "stroke", "sudden_death"] },
      { kind: "biomarker", slug: "ldl", condition: "borderline" },
      { kind: "biomarker", slug: "apob", condition: "borderline" },
      { kind: "age", min: 40 },
    ],
    euAvailable: true,
  },
  {
    id: "lp-a-test",
    name: "Lp(a) (à mesurer une fois)",
    brand: "Labo (Cerballiance, Eurofins, Synlab…)",
    category: "lab-panel",
    priceEur: "20-40€ (non remboursé)",
    url: "https://www.cerballiance.fr",
    rationaleTemplate:
      "Lp(a) est génétiquement déterminé — à mesurer UNE FOIS dans la vie. Si élevé (>50 mg/dL), facteur de risque cardio méconnu mais majeur.",
    triggers: [
      { kind: "biomarker", slug: "lp-a", condition: "missing" },
      { kind: "age", min: 25 },
    ],
    euAvailable: true,
  },
  {
    id: "omega-3-index",
    name: "Index Oméga-3 (HS-Omega-3)",
    brand: "Lab kit à domicile",
    category: "lab-panel",
    priceEur: "60€",
    url: "https://omegaquant.com/omega-3-index-test",
    rationaleTemplate:
      "Mesure le % EPA+DHA dans les membranes érythrocytaires. Cible >8% pour risque cardio minimal. Kit prélèvement bout du doigt à domicile.",
    triggers: [
      { kind: "biomarker", slug: "omega-3-index", condition: "missing" },
      { kind: "biomarker", slug: "omega-3-index", condition: "out_of_range" },
    ],
    euAvailable: true,
  },

  // === Respiration ===
  {
    id: "muse-s",
    name: "Muse S",
    brand: "Choose Muse",
    category: "respiration",
    priceEur: "399€",
    url: "https://choosemuse.com",
    rationaleTemplate:
      "Bandeau EEG + accéléro + HRV. Pour méditation guidée biofeedback + tracking sommeil profond. Investissement si pratique méditation quotidienne sérieuse.",
    triggers: [
      { kind: "goal", ids: ["Réduction stress", "Optimisation cognitive"] },
    ],
    euAvailable: true,
  },

  // === Thermal ===
  {
    id: "morozko-ice-bath",
    name: "Bain froid à domicile",
    brand: "The Cold Plunge / Plunge Eu",
    category: "thermal",
    priceEur: "2 000-5 000€",
    url: "https://plunge.com/eu",
    rationaleTemplate:
      "Bain froid 10°C à demeure pour cure hormèse régulière (HRV +, dopamine, BAT). Si déjà coldExposure 'often' et budget — sinon douche froide quotidienne suffit pour démarrer.",
    triggers: [
      { kind: "goal", ids: ["Longévité", "Performance physique"] },
    ],
    euAvailable: true,
  },
];

export const CATEGORY_LABELS_FR: Record<DeviceCategory, string> = {
  sleep: "Sommeil",
  glucose: "Glucose",
  "blood-pressure": "Tension",
  wearable: "Wearable",
  "body-composition": "Composition corporelle",
  "lab-panel": "Analyses",
  imaging: "Imagerie",
  respiration: "Respiration / méditation",
  thermal: "Thermique",
};

/**
 * Optimal & longevity-tilted reference ranges for biomarkers.
 * Sources: Peter Attia, Bryan Johnson Blueprint, RxStrong, lab consensus.
 * "optimal" = clinically optimal range; "longevity" = longevity-targeted (often tighter).
 * Slugs match what the parser produces (slugify of canonical name).
 */

export type BiomarkerMeta = {
  slug: string;
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  unit: string;
  whyMatters: string;
  related: string[];
};

export const BIOMARKER_META: BiomarkerMeta[] = [
  // === LIPIDS ===
  { slug: "cholesterol-total", unit: "g/L", optimalLow: 1.40, optimalHigh: 2.00, longevityLow: 1.40, longevityHigh: 1.90,
    whyMatters: "Cholestérol total brut — peu informatif seul. Privilégier ApoB et LDL.",
    related: ["LDL", "HDL", "Triglycérides", "ApoB"] },
  { slug: "ldl", unit: "g/L", optimalLow: 0, optimalHigh: 1.00, longevityLow: 0, longevityHigh: 0.70,
    whyMatters: "Lipoprotéines pro-athérogènes. Cible longévité <0.70 g/L (Attia, ESC). Effet cumulatif sur l'athérosclérose.",
    related: ["ApoB", "Lp(a)", "HDL"] },
  { slug: "hdl", unit: "g/L", optimalLow: 0.50, optimalHigh: 1.00, longevityLow: 0.55, longevityHigh: 0.90,
    whyMatters: "Cholestérol 'bénéfique' — anti-athérogène. Trop bas (<0.40) ou trop haut (>1.20) = signal alerte.",
    related: ["LDL", "Triglycérides", "ApoA1"] },
  { slug: "triglycerides", unit: "g/L", optimalLow: 0.50, optimalHigh: 1.00, longevityLow: 0.50, longevityHigh: 0.80,
    whyMatters: "Marqueur clé d'insulinorésistance. Cible longévité <0.80. Ratio TG/HDL <2 idéal.",
    related: ["HOMA-IR", "Glycémie", "HbA1c"] },
  { slug: "apo-b", unit: "g/L", optimalLow: 0.60, optimalHigh: 0.90, longevityLow: 0.60, longevityHigh: 0.80,
    whyMatters: "Meilleur prédicteur de risque cardio que LDL. Compte les particules athérogènes (LDL+VLDL+IDL+Lp(a)).",
    related: ["LDL", "Lp(a)", "ApoA1"] },
  { slug: "apo-a1", unit: "g/L", optimalLow: 1.30, optimalHigh: 1.80, longevityLow: 1.40, longevityHigh: 1.80,
    whyMatters: "Composante principale du HDL. Ratio ApoB/ApoA1 = puissant prédicteur cardio.",
    related: ["ApoB", "HDL"] },
  { slug: "lp-a", unit: "mg/dL", optimalLow: 0, optimalHigh: 30, longevityLow: 0, longevityHigh: 30,
    whyMatters: "Génétiquement déterminée. >50 mg/dL = risque cardio majoré. Pas de traitement spécifique sauf statines + niacine.",
    related: ["ApoB", "LDL"] },
  { slug: "index-omega-3", unit: "%", optimalLow: 8, optimalHigh: 12, longevityLow: 8, longevityHigh: 12,
    whyMatters: "% EPA+DHA dans les globules rouges. <4% = risque cardio +. >8% = optimal.",
    related: [] },

  // === METABOLIC ===
  { slug: "glycemie", unit: "g/L", optimalLow: 0.70, optimalHigh: 0.95, longevityLow: 0.75, longevityHigh: 0.90,
    whyMatters: "Glucose à jeun. >1.00 = pré-diabète risque. Cible longévité 0.75-0.90.",
    related: ["HbA1c", "Insuline", "HOMA-IR"] },
  { slug: "hba1c", unit: "%", optimalLow: 4.5, optimalHigh: 5.4, longevityLow: 4.8, longevityHigh: 5.2,
    whyMatters: "Glycation moyenne sur 3 mois. >5.7% = pré-diabète. Cible longévité <5.2%.",
    related: ["Glycémie", "HOMA-IR"] },
  { slug: "insuline", unit: "μUI/mL", optimalLow: 2, optimalHigh: 10, longevityLow: 2, longevityHigh: 6,
    whyMatters: "Insuline à jeun. >10 = insulinorésistance. Cible longévité <6 (Bryan Johnson).",
    related: ["HOMA-IR", "Glycémie", "Triglycérides"] },
  { slug: "homa-ir", unit: "", optimalLow: 0, optimalHigh: 1.5, longevityLow: 0, longevityHigh: 1.0,
    whyMatters: "Indice de résistance à l'insuline = (Glucose × Insuline)/22.5. <1.0 = optimale, >2.5 = résistance.",
    related: ["Insuline", "Glycémie", "Triglycérides"] },

  // === THYROID ===
  { slug: "tsh", unit: "μUI/mL", optimalLow: 0.5, optimalHigh: 2.5, longevityLow: 1.0, longevityHigh: 2.0,
    whyMatters: "Hormone hypophysaire qui régule la thyroïde. Range labo 0.4-4.5 trop large. Optimum fonctionnel 1-2.",
    related: ["T3 libre", "T4 libre", "Anti-TPO"] },
  { slug: "t3-libre", unit: "pmol/L", optimalLow: 4.5, optimalHigh: 6.5, longevityLow: 4.8, longevityHigh: 6.0,
    whyMatters: "Forme active. Plus pertinente que T4 pour fonction tissulaire.",
    related: ["TSH", "T4 libre", "T3 reverse"] },
  { slug: "t4-libre", unit: "pmol/L", optimalLow: 14, optimalHigh: 19, longevityLow: 15, longevityHigh: 18,
    whyMatters: "Forme de stockage. Conversion T4→T3 en périphérie (DIO1/DIO2).",
    related: ["TSH", "T3 libre"] },

  // === HORMONES ===
  { slug: "testosterone-totale", unit: "ng/mL", optimalLow: 5.5, optimalHigh: 9.5, longevityLow: 6.0, longevityHigh: 9.0,
    whyMatters: "Range labo 2.5-10 trop large. Optimum fonctionnel masculin >5.5. Influence libido, force, mood, métabolique.",
    related: ["Testostérone libre", "SHBG", "Œstradiol"] },
  { slug: "testosterone-libre", unit: "pg/mL", optimalLow: 100, optimalHigh: 250, longevityLow: 120, longevityHigh: 220,
    whyMatters: "Fraction biodisponible. Plus pertinente que totale chez l'homme âgé. Calculée via SHBG.",
    related: ["Testostérone totale", "SHBG"] },
  { slug: "shbg", unit: "nmol/L", optimalLow: 20, optimalHigh: 50, longevityLow: 25, longevityHigh: 45,
    whyMatters: "Sex Hormone Binding Globulin. Trop haute = testo libre faible. Influence par insuline (basse SHBG = insulinorésistance).",
    related: ["Testostérone libre", "Œstradiol"] },
  { slug: "œstradiol", unit: "pg/mL", optimalLow: 20, optimalHigh: 40, longevityLow: 25, longevityHigh: 35,
    whyMatters: "Chez l'homme: trop bas = ostéoporose, trop haut = gyno. Aromatisation de la testo.",
    related: ["Testostérone totale", "DHT"] },
  { slug: "dhea-s", unit: "μg/dL", optimalLow: 200, optimalHigh: 500, longevityLow: 250, longevityHigh: 450,
    whyMatters: "Précurseur des hormones sexuelles. Décline avec l'âge. Niveau de jeunesse = >300 chez homme adulte.",
    related: ["Cortisol", "Testostérone totale"] },
  { slug: "cortisol", unit: "nmol/L", optimalLow: 200, optimalHigh: 500, longevityLow: 250, longevityHigh: 450,
    whyMatters: "Hormone du stress. Mesurer le matin (8h). Élevé chronique = vieillissement, mémoire, immunité.",
    related: ["DHEA-S", "ACTH"] },
  { slug: "igf-1", unit: "ng/mL", optimalLow: 120, optimalHigh: 220, longevityLow: 130, longevityHigh: 200,
    whyMatters: "Médiateur GH. Trop bas = sarcopénie. Trop haut = risque cancer/longévité réduite (mTOR).",
    related: ["GH (hormone de croissance)"] },

  // === VITAMINS ===
  { slug: "vitamine-d-25-oh", unit: "ng/mL", optimalLow: 40, optimalHigh: 80, longevityLow: 50, longevityHigh: 70,
    whyMatters: "Range labo >30 minimum. Optimum 40-60 ng/mL. Immunité, os, cancer, immunomodulation.",
    related: ["Calcium sérique", "PTH"] },
  { slug: "vitamine-b12", unit: "pg/mL", optimalLow: 500, optimalHigh: 1500, longevityLow: 600, longevityHigh: 1200,
    whyMatters: "Range labo >200 trop bas. Optimum >500. Si MTHFR/MTR variants, viser >700.",
    related: ["Folates (B9)", "MMA", "Homocystéine"] },
  { slug: "folates-b9", unit: "ng/mL", optimalLow: 8, optimalHigh: 25, longevityLow: 10, longevityHigh: 20,
    whyMatters: "Nécessaire à méthylation. Si MTHFR TT, préférer méthylfolate.",
    related: ["Vitamine B12", "Homocystéine"] },
  { slug: "holotranscobalamine-active-b12", unit: "pmol/L", optimalLow: 50, optimalHigh: 200, longevityLow: 70, longevityHigh: 180,
    whyMatters: "Forme bioactive de B12. Plus pertinente que B12 totale.",
    related: ["Vitamine B12", "MMA"] },

  // === IRON ===
  { slug: "ferritine", unit: "ng/mL", optimalLow: 50, optimalHigh: 150, longevityLow: 70, longevityHigh: 120,
    whyMatters: "Réserves de fer + marqueur inflammation. <30 = carence, >300 = surcharge ou inflammation.",
    related: ["Fer sérique", "Saturation transferrine"] },
  { slug: "saturation-transferrine", unit: "%", optimalLow: 25, optimalHigh: 45, longevityLow: 25, longevityHigh: 40,
    whyMatters: ">45% = suspicion hémochromatose. <20% = carence. Combine avec ferritine.",
    related: ["Ferritine", "Fer sérique"] },

  // === KIDNEY/LIVER ===
  { slug: "creatinine", unit: "mg/L", optimalLow: 6, optimalHigh: 12, longevityLow: 7, longevityHigh: 11,
    whyMatters: "Marqueur fonction rénale. Influencé par masse musculaire.",
    related: ["DFG (filtration glomérulaire)", "Urée", "Cystatine C"] },
  { slug: "dfg-filtration-glomerulaire", unit: "mL/min", optimalLow: 90, optimalHigh: 130, longevityLow: 90, longevityHigh: 120,
    whyMatters: "Filtration glomérulaire estimée. >90 = normal. Décline avec âge (~1mL/min/an après 40).",
    related: ["Créatinine", "Cystatine C"] },
  { slug: "asat-got", unit: "UI/L", optimalLow: 10, optimalHigh: 25, longevityLow: 15, longevityHigh: 25,
    whyMatters: "Aspartate aminotransférase. Élévation = lésion hépatique/musculaire.",
    related: ["ALAT (GPT)", "GGT"] },
  { slug: "alat-gpt", unit: "UI/L", optimalLow: 10, optimalHigh: 25, longevityLow: 10, longevityHigh: 22,
    whyMatters: "Plus spécifique du foie qu'ASAT. Cible longévité <22.",
    related: ["ASAT (GOT)", "GGT"] },
  { slug: "ggt", unit: "UI/L", optimalLow: 10, optimalHigh: 25, longevityLow: 10, longevityHigh: 20,
    whyMatters: "Marqueur ultra-sensible alcool, stéatose hépatique, oxydatif. Cible longévité <20.",
    related: ["ALAT (GPT)", "ASAT (GOT)"] },

  // === INFLAMMATION ===
  { slug: "crp", unit: "mg/L", optimalLow: 0, optimalHigh: 1.0, longevityLow: 0, longevityHigh: 0.5,
    whyMatters: "Marqueur inflammation aiguë. Chronique >2 = risque cardio +. Cible longévité <0.5.",
    related: ["Fibrinogène", "VS"] },
  { slug: "crp-ultrasensible-hscrp", unit: "mg/L", optimalLow: 0, optimalHigh: 1.0, longevityLow: 0, longevityHigh: 0.5,
    whyMatters: "CRP haute sensibilité. <1 = bon, 1-3 = modéré, >3 = élevé.",
    related: ["CRP", "Fibrinogène"] },
  { slug: "fibrinogene", unit: "g/L", optimalLow: 2.0, optimalHigh: 3.5, longevityLow: 2.0, longevityHigh: 3.0,
    whyMatters: "Marqueur inflammation + thrombose. Élevé = risque cardio.",
    related: ["CRP", "D-dimères"] },
  { slug: "homocysteine", unit: "μmol/L", optimalLow: 5, optimalHigh: 9, longevityLow: 5, longevityHigh: 8,
    whyMatters: "Marqueur de méthylation et risque cardio. >10 = MTHFR ou carence B12/folates/B6.",
    related: ["Vitamine B12", "Folates (B9)"] },

  // === MINERALS ===
  { slug: "magnesium-erythrocytaire", unit: "mmol/L", optimalLow: 1.65, optimalHigh: 2.65, longevityLow: 1.80, longevityHigh: 2.50,
    whyMatters: "Plus précis que magnésium sérique. Carence très commune (90% pop).",
    related: ["Calcium sérique"] },
  { slug: "zinc-serique", unit: "μg/dL", optimalLow: 80, optimalHigh: 120, longevityLow: 90, longevityHigh: 110,
    whyMatters: "Cofacteur de 300+ enzymes. Influence immunité, testostérone, thyroïde.",
    related: [] },
  { slug: "selenium", unit: "μg/L", optimalLow: 100, optimalHigh: 150, longevityLow: 110, longevityHigh: 140,
    whyMatters: "Antioxydant majeur. Conversion T4→T3. Cible 100-150 μg/L.",
    related: ["T3 libre"] },
];

export const META_BY_SLUG: Record<string, BiomarkerMeta> = Object.fromEntries(BIOMARKER_META.map((m) => [m.slug, m]));

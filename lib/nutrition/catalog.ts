import type { RuleHit } from "./types";

export type BiomarkerLatest = {
  slug: string;
  name: string;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  date: number;
  optimalLow?: number | null;
  optimalHigh?: number | null;
};

type BiomarkerRule = {
  slug: string;
  benefit: string;
  priority: "high" | "moderate" | "info";
  trigger: (b: BiomarkerLatest) => boolean;
  /** What to favor */
  favor?: { foodSlugs: string[]; reason: string };
  /** What to avoid */
  avoid?: { foodSlugs: string[]; reason: string };
};

// 35 biomarker → food rules.
// Triggers compare value vs. optimal ranges (when available) or absolute thresholds.
// Reasons must be readable by the end-user (FR, no jargon obscur).

export const BIOMARKER_RULES: BiomarkerRule[] = [
  // === Lipids ===
  {
    slug: "ldl", benefit: "Cardio-vasculaire", priority: "high",
    trigger: (b) => b.value > 100,
    favor: { foodSlugs: ["oats-steel-cut", "lentils-green", "almonds", "olive-oil-evoo", "salmon-wild", "sardines", "avocado", "broccoli", "blueberry", "walnuts"], reason: "LDL au-dessus de la cible. Fibres solubles + oméga-3 + monoinsaturés baissent le LDL et l'ApoB." },
    avoid: { foodSlugs: ["seed-oils-industrial", "fast-food", "processed-meat", "margarine", "ultraprocessed-snacks"], reason: "Acides gras trans et huiles oxydées augmentent LDL oxydé et inflammation vasculaire." },
  },
  {
    slug: "apo-b", benefit: "Cardio-vasculaire", priority: "high",
    trigger: (b) => b.value > 90,
    favor: { foodSlugs: ["salmon-wild", "sardines", "olive-oil-evoo", "oats-steel-cut", "flax-seeds", "chia-seeds", "almonds", "kale"], reason: "ApoB élevé = nombre de particules athérogènes élevé. Oméga-3 + fibres solubles + monoinsaturés baissent ApoB." },
    avoid: { foodSlugs: ["sugar-white", "high-fructose-corn-syrup", "fast-food", "processed-meat"], reason: "Sucres rapides → VLDL → ApoB élevé. Réduire les sucres ajoutés." },
  },
  {
    slug: "hdl", benefit: "Cardio-vasculaire", priority: "moderate",
    trigger: (b) => b.value < 50,
    favor: { foodSlugs: ["olive-oil-evoo", "avocado", "salmon-wild", "almonds", "walnuts", "olive-fruit", "egg-pasture"], reason: "HDL bas. Monoinsaturés et oméga-3 + activité physique remontent HDL." },
  },
  {
    slug: "triglycerides", benefit: "Métabolique", priority: "high",
    trigger: (b) => b.value > 100,
    favor: { foodSlugs: ["salmon-wild", "sardines", "mackerel", "broccoli", "spinach", "olive-oil-evoo"], reason: "Triglycérides élevés. EPA+DHA réduisent TG de 20-30%, glucides bas aident aussi." },
    avoid: { foodSlugs: ["sugar-white", "high-fructose-corn-syrup", "fruit-juice", "soda-sugary", "alcohol", "white-flour", "wheat-pasta", "white-rice"], reason: "Fructose et glucides raffinés → lipogenèse hépatique → TG élevés." },
  },
  {
    slug: "lp-a", benefit: "Cardio-vasculaire", priority: "high",
    trigger: (b) => b.value > 30,
    favor: { foodSlugs: ["salmon-wild", "olive-oil-evoo", "almonds", "broccoli", "kale", "pomegranate"], reason: "Lp(a) génétique majoritairement, mais nutrition anti-inflammatoire réduit risque cardio global associé." },
  },
  {
    slug: "index-omega-3", benefit: "Anti-inflammatoire", priority: "high",
    trigger: (b) => b.value < 8,
    favor: { foodSlugs: ["salmon-wild", "sardines", "mackerel", "anchovies", "herring", "flax-seeds", "chia-seeds", "walnuts"], reason: "Index oméga-3 sous 8% = risque cardio + inflammation. Cible: poisson gras 3-4x/sem ou EPA/DHA 2g/j." },
  },

  // === Métabolique / glycémie ===
  {
    slug: "hba1c", benefit: "Glycémie", priority: "high",
    trigger: (b) => b.value > 5.4,
    favor: { foodSlugs: ["broccoli", "kale", "spinach", "lentils-green", "salmon-wild", "avocado", "olive-oil-evoo", "cinnamon"], reason: "HbA1c hors cible longévité. Prioriser glucides lents + fibres + protéines + lipides bons à chaque repas." },
    avoid: { foodSlugs: ["sugar-white", "high-fructose-corn-syrup", "soda-sugary", "fruit-juice", "white-flour", "wheat-bread-white", "wheat-pasta", "white-rice", "ultraprocessed-snacks"], reason: "Sucres rapides et glucides raffinés font monter HbA1c. Éliminer en priorité boissons sucrées et farines blanches." },
  },
  {
    slug: "glycemie", benefit: "Glycémie", priority: "moderate",
    trigger: (b) => b.value > 95,
    favor: { foodSlugs: ["broccoli", "asparagus", "spinach", "salmon-wild", "olive-oil-evoo", "egg-pasture"], reason: "Glycémie à jeun élevée. Manger protéines + lipides + fibres avant glucides (séquence Kessler)." },
    avoid: { foodSlugs: ["sugar-white", "soda-sugary", "fruit-juice", "white-rice", "white-flour"], reason: "Réduire la charge glycémique au petit-déj surtout." },
  },
  {
    slug: "insuline", benefit: "Glycémie", priority: "high",
    trigger: (b) => b.value > 10,
    favor: { foodSlugs: ["salmon-wild", "avocado", "olive-oil-evoo", "broccoli", "kale", "almonds", "egg-pasture"], reason: "Insulinémie haute = résistance à l'insuline. Approche low-carb modérée + jeûne intermittent 14-16h." },
    avoid: { foodSlugs: ["sugar-white", "high-fructose-corn-syrup", "fruit-juice", "soda-sugary", "white-rice", "white-flour", "wheat-pasta"], reason: "Spike glucose → spike insuline. Couper les glucides raffinés en priorité." },
  },
  {
    slug: "homa-ir", benefit: "Glycémie", priority: "high",
    trigger: (b) => b.value > 1.5,
    favor: { foodSlugs: ["broccoli", "cinnamon", "turmeric", "salmon-wild", "olive-oil-evoo", "almonds"], reason: "HOMA-IR > 1.5 = résistance à l'insuline. Régime méditerranéen low-carb prouvé efficace." },
    avoid: { foodSlugs: ["sugar-white", "high-fructose-corn-syrup", "soda-sugary", "fruit-juice", "white-rice", "white-flour"], reason: "Réduire les glucides à index glycémique élevé." },
  },

  // === Inflammation ===
  {
    slug: "crp-ultrasensible-hscrp", benefit: "Anti-inflammatoire", priority: "high",
    trigger: (b) => b.value > 1.0,
    favor: { foodSlugs: ["salmon-wild", "sardines", "turmeric", "ginger", "broccoli", "blueberry", "olive-oil-evoo", "green-tea", "dark-chocolate"], reason: "hsCRP > 1.0 = inflammation systémique. Oméga-3, polyphénols et curcumine réduisent CRP." },
    avoid: { foodSlugs: ["seed-oils-industrial", "sugar-white", "fast-food", "processed-meat", "ultraprocessed-snacks", "wheat-bread-white"], reason: "Huiles oméga-6 oxydées + sucre + ultra-transformés = pro-inflammatoires." },
  },
  {
    slug: "crp", benefit: "Anti-inflammatoire", priority: "moderate",
    trigger: (b) => b.value > 1.0,
    favor: { foodSlugs: ["salmon-wild", "turmeric", "ginger", "blueberry", "olive-oil-evoo"], reason: "CRP élevée = inflammation. Augmenter aliments anti-inflammatoires." },
    avoid: { foodSlugs: ["seed-oils-industrial", "sugar-white", "fast-food"], reason: "Réduire pro-inflammatoires industriels." },
  },
  {
    slug: "fibrinogene", benefit: "Cardio-vasculaire", priority: "moderate",
    trigger: (b) => b.value > 3.5,
    favor: { foodSlugs: ["salmon-wild", "garlic", "ginger", "turmeric", "green-tea"], reason: "Fibrinogène élevé = risque thrombotique. Aliments fluidifiants + anti-inflammatoires." },
  },

  // === Méthylation / B-vitamines ===
  {
    slug: "homocysteine", benefit: "Méthylation", priority: "high",
    trigger: (b) => b.value > 9,
    favor: { foodSlugs: ["spinach", "kale", "lentils-green", "broccoli", "asparagus", "liver-beef", "egg-pasture", "salmon-wild", "natto"], reason: "Homocystéine > 9 = méthylation sub-optimale. Folates naturels (épinards, lentilles, foie) + B12 (oeufs, poisson) + B6 + bétaïne." },
    avoid: { foodSlugs: ["alcohol", "wine-red", "beer", "spirits", "supplemented-folic-acid", "folate-fortified-cereals"], reason: "Alcool consomme folates et B12. Acide folique synthétique peut s'accumuler chez MTHFR mutés — préférer méthylfolate." },
  },
  {
    slug: "vitamine-b12", benefit: "B12", priority: "high",
    trigger: (b) => b.value < 500,
    favor: { foodSlugs: ["liver-beef", "liver-chicken", "oysters", "sardines", "salmon-wild", "egg-pasture", "natto"], reason: "B12 sous 500 pg/mL. Source animale obligatoire (la B12 végétale n'existe pas). Si végan: supplémentation indispensable." },
  },
  {
    slug: "holotranscobalamine-active-b12", benefit: "B12", priority: "high",
    trigger: (b) => b.value < 50,
    favor: { foodSlugs: ["liver-beef", "oysters", "sardines", "salmon-wild", "egg-pasture"], reason: "B12 active basse — meilleur marqueur que B12 totale. Augmenter sources animales ou supplémenter méthylcobalamine." },
  },
  {
    slug: "folates-b9", benefit: "Méthylation", priority: "high",
    trigger: (b) => b.value < 8,
    favor: { foodSlugs: ["spinach", "kale", "asparagus", "lentils-green", "lentils-red", "chickpeas", "broccoli", "liver-chicken", "edamame"], reason: "Folates bas. Privilégier folates alimentaires (légumes verts crus ou peu cuits) plutôt qu'acide folique synthétique." },
    avoid: { foodSlugs: ["supplemented-folic-acid", "folate-fortified-cereals"], reason: "L'acide folique synthétique non-réduit s'accumule (UMFA) chez les MTHFR mutés." },
  },

  // === Fer ===
  {
    slug: "ferritine", benefit: "Fer", priority: "high",
    trigger: (b) => b.value < 70,
    favor: { foodSlugs: ["liver-beef", "liver-chicken", "beef-grass-fed", "lamb", "oysters", "mussels", "spinach", "lentils-green", "pumpkin-seeds", "dark-chocolate", "citrus-orange"], reason: "Ferritine < 70 = réserves de fer basses. Privilégier fer héminique (viande/abats) + co-facteurs (vit C avec fer non-héminique)." },
    avoid: { foodSlugs: ["green-tea", "matcha", "coffee-black"], reason: "Tanins du thé/café réduisent absorption du fer non-héminique. À distancer 1h des repas riches en fer." },
  },
  {
    slug: "saturation-transferrine", benefit: "Fer", priority: "moderate",
    trigger: (b) => b.value < 25 || b.value > 45,
    favor: { foodSlugs: ["citrus-orange", "bell-pepper", "kiwi", "spinach", "lentils-green"], reason: "Saturation transferrine hors cible. Si basse: vitamine C avec fer. Si haute: surveiller hémochromatose (HFE)." },
  },

  // === Thyroïde ===
  {
    slug: "tsh", benefit: "Thyroïde", priority: "moderate",
    trigger: (b) => b.value > 2.5,
    favor: { foodSlugs: ["seaweed-nori", "cod", "shrimp", "oysters", "brazil-nuts", "sardines", "egg-pasture"], reason: "TSH au-dessus de l'optimum fonctionnel (cible <2.5). Iode (algues, poissons) + sélénium (noix du Brésil) + tyrosine." },
    avoid: { foodSlugs: ["broccoli", "kale", "cabbage-red", "brussels-sprouts", "cauliflower"], reason: "Crucifères crus contiennent goitrogènes — privilégier cuits si TSH élevée et apport iode bas." },
  },
  {
    slug: "t3-libre", benefit: "Thyroïde", priority: "moderate",
    trigger: (b) => b.value < 4.5,
    favor: { foodSlugs: ["brazil-nuts", "oysters", "sardines", "egg-pasture", "seaweed-nori"], reason: "T3 libre basse (conversion T4→T3 sub-optimale). Sélénium (DIO1/DIO2) + zinc + iode." },
  },

  // === Hormones ===
  {
    slug: "testosterone-totale", benefit: "Hormones", priority: "moderate",
    trigger: (b) => b.value < 5.5,
    favor: { foodSlugs: ["oysters", "egg-pasture", "beef-grass-fed", "olive-oil-evoo", "avocado", "pumpkin-seeds", "dark-chocolate"], reason: "Testostérone basse. Zinc + bons lipides + sommeil + entraînement de force essentiels." },
    avoid: { foodSlugs: ["soda-sugary", "alcohol", "ultraprocessed-snacks", "seed-oils-industrial"], reason: "Sucre + alcool + huiles industrielles abaissent la testostérone via inflammation et résistance insuline." },
  },
  {
    slug: "shbg", benefit: "Hormones", priority: "info",
    trigger: (b) => b.value > 50 || b.value < 20,
    favor: { foodSlugs: ["egg-pasture", "almonds", "olive-oil-evoo"], reason: "SHBG hors cible — affecte fraction libre des hormones sexuelles. Lipides corrects + fibres modérées." },
  },
  {
    slug: "cortisol", benefit: "Stress", priority: "moderate",
    trigger: (b) => b.value > 500,
    favor: { foodSlugs: ["dark-chocolate", "salmon-wild", "spinach", "almonds", "green-tea", "blueberry"], reason: "Cortisol élevé = charge stress / inflammation. Magnésium, oméga-3 et polyphénols modulent l'axe HPA." },
    avoid: { foodSlugs: ["coffee-black", "matcha", "alcohol", "sugar-white"], reason: "Caféine en excès et alcool perturbent l'axe cortisol — réduire surtout après 14h." },
  },

  // === Foie / reins ===
  {
    slug: "ggt", benefit: "Foie", priority: "moderate",
    trigger: (b) => b.value > 25,
    favor: { foodSlugs: ["broccoli", "broccoli-sprouts", "cauliflower", "garlic", "turmeric", "artichoke", "beetroot"], reason: "GGT élevée = stress hépatique. Crucifères et glutathion-supportants soutiennent la phase II du foie." },
    avoid: { foodSlugs: ["alcohol", "wine-red", "beer", "spirits", "fast-food", "fruit-juice", "soda-sugary"], reason: "Alcool et fructose surchargent le foie. Réduire ou éliminer." },
  },
  {
    slug: "alat-gpt", benefit: "Foie", priority: "moderate",
    trigger: (b) => b.value > 25,
    favor: { foodSlugs: ["broccoli", "garlic", "turmeric", "artichoke", "olive-oil-evoo", "green-tea"], reason: "ALAT élevée = stéatose hépatique probable. Régime méditerranéen + perte de gras viscéral." },
    avoid: { foodSlugs: ["alcohol", "fruit-juice", "soda-sugary", "high-fructose-corn-syrup", "fast-food"], reason: "Fructose et alcool = stéatose. Couper les boissons sucrées en priorité." },
  },
  {
    slug: "asat-got", benefit: "Foie", priority: "info",
    trigger: (b) => b.value > 30,
    favor: { foodSlugs: ["broccoli", "olive-oil-evoo", "green-tea"], reason: "ASAT élevée — vérifier ratio ASAT/ALAT et CPK avant de conclure (peut venir muscle)." },
  },
  {
    slug: "creatinine", benefit: "Reins", priority: "moderate",
    trigger: (b) => b.value > 11,
    favor: { foodSlugs: ["water-mineral", "blueberry", "kale", "olive-oil-evoo"], reason: "Créatinine élevée. Hydratation, fonction rénale à surveiller. Éviter excès de protéines si insuffisance." },
    avoid: { foodSlugs: ["processed-meat", "fast-food"], reason: "Viande transformée et excès sel stressent les reins." },
  },
  {
    slug: "dfg-filtration-glomerulaire", benefit: "Reins", priority: "moderate",
    trigger: (b) => b.value < 90,
    favor: { foodSlugs: ["water-mineral", "blueberry", "olive-oil-evoo"], reason: "DFG en baisse. Hydratation, modération protéique, contrôle tension." },
    avoid: { foodSlugs: ["processed-meat", "fast-food"], reason: "Viande transformée et excès sel néfastes pour fonction rénale." },
  },

  // === Micronutriments ===
  {
    slug: "vitamine-d-25-oh", benefit: "Vitamine D", priority: "high",
    trigger: (b) => b.value < 40,
    favor: { foodSlugs: ["salmon-wild", "sardines", "mackerel", "egg-yolk", "mushroom-shiitake", "cod", "herring"], reason: "Vitamine D < 40 ng/mL. Soleil + poissons gras + œufs. Souvent insuffisant sans supplémentation D3 hivernale." },
  },
  {
    slug: "magnesium-erythrocytaire", benefit: "Magnésium", priority: "moderate",
    trigger: (b) => b.value < 1.80,
    favor: { foodSlugs: ["spinach", "swiss-chard", "almonds", "pumpkin-seeds", "dark-chocolate", "avocado", "brown-rice", "black-beans"], reason: "Magnésium intracellulaire bas. Cible aliments riches + supplémentation glycinate possible." },
  },
  {
    slug: "zinc-serique", benefit: "Zinc", priority: "moderate",
    trigger: (b) => b.value < 90,
    favor: { foodSlugs: ["oysters", "beef-grass-fed", "lamb", "pumpkin-seeds", "almonds", "egg-pasture"], reason: "Zinc bas. Zinc des huîtres = champion absolu (50mg/100g). Soutien testostérone, immunité, peau." },
  },
  {
    slug: "selenium", benefit: "Sélénium", priority: "moderate",
    trigger: (b) => b.value < 100,
    favor: { foodSlugs: ["brazil-nuts", "sardines", "tuna-bluefin", "egg-pasture", "sunflower-seeds", "mushroom-button"], reason: "Sélénium bas. 2 noix du Brésil/jour = couverture quotidienne. Sinon poissons gras et œufs." },
  },

  // === Autres ===
  {
    slug: "igf-1", benefit: "Longévité", priority: "info",
    trigger: (b) => b.value > 220,
    favor: { foodSlugs: ["broccoli", "kale", "lentils-green", "olive-oil-evoo"], reason: "IGF-1 élevée = signal pro-croissance. Modération protéine animale + jeûne intermittent abaissent IGF-1." },
    avoid: { foodSlugs: ["milk-cow", "yogurt-greek", "cheese-aged", "processed-meat"], reason: "Excès laitages et viande rouge augmentent IGF-1. Modérer si > 200 ng/mL." },
  },
  {
    slug: "dhea-s", benefit: "Hormones", priority: "info",
    trigger: (b) => b.value < 200,
    favor: { foodSlugs: ["egg-pasture", "salmon-wild", "olive-oil-evoo", "avocado"], reason: "DHEA-S bas (souvent age-related). Bons lipides + sommeil + gestion stress." },
  },
  {
    slug: "œstradiol", benefit: "Hormones", priority: "info",
    trigger: (b) => b.value > 40,
    favor: { foodSlugs: ["broccoli", "broccoli-sprouts", "cauliflower", "kale", "flax-seeds"], reason: "Œstradiol élevé. Crucifères (DIM/I3C) modulent métabolisme des œstrogènes en faveur du 2-OH." },
  },
  {
    slug: "testosterone-libre", benefit: "Hormones", priority: "info",
    trigger: (b) => b.value < 100,
    favor: { foodSlugs: ["oysters", "egg-pasture", "olive-oil-evoo", "pumpkin-seeds"], reason: "Testostérone libre basse — vérifier SHBG. Zinc + lipides + sommeil." },
  },
  {
    slug: "apo-a1", benefit: "Cardio-vasculaire", priority: "info",
    trigger: (b) => b.value < 130,
    favor: { foodSlugs: ["olive-oil-evoo", "avocado", "salmon-wild", "almonds"], reason: "Apo A1 bas (HDL fonctionnel). Monoinsaturés et oméga-3 améliorent qualité HDL." },
  },
];

export const RULES_BY_SLUG: Record<string, BiomarkerRule> = Object.fromEntries(BIOMARKER_RULES.map((r) => [r.slug, r]));

/** Apply biomarker rules to a list of latest biomarkers, return rule hits (favor + avoid both as separate hits). */
export function applyBiomarkerRules(latest: BiomarkerLatest[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const b of latest) {
    const rule = RULES_BY_SLUG[b.slug];
    if (!rule) continue;
    if (!rule.trigger(b)) continue;
    if (rule.favor) {
      hits.push({
        source: "biomarker", ruleKey: `${rule.slug}:favor`, subject: b.slug, subjectLabel: b.name,
        reason: rule.favor.reason, benefit: rule.benefit, priority: rule.priority,
        action: "favor", foodSlugs: rule.favor.foodSlugs, href: `/biomarkers/${b.slug}`,
      });
    }
    if (rule.avoid) {
      hits.push({
        source: "biomarker", ruleKey: `${rule.slug}:avoid`, subject: b.slug, subjectLabel: b.name,
        reason: rule.avoid.reason, benefit: rule.benefit, priority: rule.priority,
        action: "avoid", foodSlugs: rule.avoid.foodSlugs, href: `/biomarkers/${b.slug}`,
      });
    }
  }
  return hits;
}

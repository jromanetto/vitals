import type { RuleHit } from "./types";

export type DnaInsightRow = {
  rsid: string;
  trait: string;
  userGenotype: string;
  category: string;
};

type DnaRule = {
  rsid: string;
  benefit: string;
  priority: "high" | "moderate" | "info";
  /** Genotypes (sorted alphabetically) considered "actionable" for this rule */
  matchGenotypes: string[];
  favor?: { foodSlugs: string[]; reason: (genotype: string) => string };
  avoid?: { foodSlugs: string[]; reason: (genotype: string) => string };
};

// 35 SNP → food rules. Most actionable nutrigenetics SNPs.
// matchGenotypes use sorted-alphabetical form (CC, CT not TC, AG not GA).
export const DNA_RULES: DnaRule[] = [
  // === MTHFR / méthylation ===
  {
    rsid: "rs1801133", benefit: "Méthylation", priority: "high",
    matchGenotypes: ["TT", "CT"],
    favor: { foodSlugs: ["spinach", "kale", "asparagus", "lentils-green", "broccoli", "liver-chicken", "natto", "egg-pasture"],
      reason: (g) => `MTHFR C677T (${g}) — réduit la conversion folate. Privilégier folates naturels (folate alimentaire) et méthylcobalamine.` },
    avoid: { foodSlugs: ["supplemented-folic-acid", "folate-fortified-cereals", "alcohol", "wine-red", "beer"],
      reason: (g) => `MTHFR C677T (${g}) — l'acide folique synthétique s'accumule (UMFA) chez les mutés. L'alcool consomme folates et B12.` },
  },
  {
    rsid: "rs1801131", benefit: "Méthylation", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["spinach", "asparagus", "broccoli", "egg-pasture", "salmon-wild"],
      reason: (g) => `MTHFR A1298C (${g}) — soutien méthylation par folates naturels + B12 active.` },
  },
  {
    rsid: "rs1805087", benefit: "Méthylation", priority: "moderate",
    matchGenotypes: ["GG", "AG"],
    favor: { foodSlugs: ["liver-beef", "oysters", "sardines", "egg-pasture"],
      reason: (g) => `MTR A2756G (${g}) — méthionine synthase ralentie. B12 active alimentaire ou supplémentation indispensable.` },
  },
  {
    rsid: "rs1801394", benefit: "Méthylation", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["liver-beef", "oysters", "salmon-wild", "egg-pasture"],
      reason: (g) => `MTRR A66G (${g}) — recyclage B12 réduit. Augmenter B12 via foie, fruits de mer, œufs.` },
  },

  // === APOE ===
  {
    rsid: "rs429358", benefit: "Cardio + Cognition", priority: "high",
    matchGenotypes: ["CC", "CT"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "olive-oil-evoo", "blueberry", "broccoli", "kale", "walnuts", "matcha", "turmeric"],
      reason: (g) => `APOE ε4 (${g}) — sensibilité aux saturés + risque Alzheimer. Méditerranéen / MIND prouvé protecteur.` },
    avoid: { foodSlugs: ["beef-conventional", "processed-meat", "butter-grass-fed", "cheese-aged", "fast-food", "alcohol"],
      reason: (g) => `APOE ε4 (${g}) — graisses saturées élèvent fortement le LDL chez ε4. Limiter viande rouge et laitages gras.` },
  },

  // === FTO obésité / appétit ===
  {
    rsid: "rs9939609", benefit: "Métabolique", priority: "moderate",
    matchGenotypes: ["AA", "AT"],
    favor: { foodSlugs: ["egg-pasture", "salmon-wild", "lentils-green", "broccoli", "almonds", "avocado"],
      reason: (g) => `FTO (${g}) — augmente sensation de faim, préférence aliments énergétiques. Privilégier protéines + fibres à chaque repas pour rassasiement.` },
    avoid: { foodSlugs: ["fast-food", "ultraprocessed-snacks", "soda-sugary", "high-fructose-corn-syrup"],
      reason: (g) => `FTO (${g}) — amplifie l'effet "hedonic" des ultra-transformés. Stratégie: éviter en environnement domestique.` },
  },

  // === TCF7L2 — diabète T2 ===
  {
    rsid: "rs7903146", benefit: "Glycémie", priority: "high",
    matchGenotypes: ["TT", "CT"],
    favor: { foodSlugs: ["broccoli", "kale", "salmon-wild", "olive-oil-evoo", "almonds", "lentils-green", "cinnamon"],
      reason: (g) => `TCF7L2 (${g}) — risque diabète T2 majoré. Régime low-carb / méditerranéen + activité après repas.` },
    avoid: { foodSlugs: ["sugar-white", "high-fructose-corn-syrup", "soda-sugary", "fruit-juice", "white-flour", "wheat-pasta", "white-rice"],
      reason: (g) => `TCF7L2 (${g}) — limiter glucides à index glycémique élevé en priorité.` },
  },

  // === Caféine CYP1A2 ===
  {
    rsid: "rs762551", benefit: "Caféine", priority: "moderate",
    matchGenotypes: ["CC", "AC"],
    avoid: { foodSlugs: ["coffee-black", "matcha", "green-tea"],
      reason: (g) => `CYP1A2 (${g}) — métabolisme caféine LENT. >2 cafés/j augmente risque cardio. Limiter à 1 café AM, éviter après 12h.` },
  },

  // === Alcool ALDH2 ===
  {
    rsid: "rs671", benefit: "Alcool", priority: "high",
    matchGenotypes: ["AA", "AG"],
    avoid: { foodSlugs: ["alcohol", "wine-red", "beer", "spirits"],
      reason: (g) => `ALDH2 (${g}) — accumulation acétaldéhyde, risque cancer œsophage majoré. Abstinence recommandée.` },
  },

  // === HLA-DQ2.5 cœliaque ===
  {
    rsid: "rs2187668", benefit: "Gluten", priority: "high",
    matchGenotypes: ["AA", "AG"],
    avoid: { foodSlugs: ["wheat-bread-white", "wheat-pasta", "sourdough-bread", "rye-bread", "barley", "white-flour", "beer"],
      reason: (g) => `HLA-DQ2.5 (${g}) — risque cœliaque accru. Si symptômes ou anti-tTG positifs: éviction stricte du gluten.` },
    favor: { foodSlugs: ["quinoa", "buckwheat", "brown-rice", "white-rice", "oats-steel-cut"],
      reason: (g) => `HLA-DQ2.5 (${g}) — alternatives sans gluten naturelles (vérifier "sans contamination" pour avoine).` },
  },

  // === Vitamin D — VDR / GC ===
  {
    rsid: "rs2228570", benefit: "Vitamine D", priority: "moderate",
    matchGenotypes: ["TT"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "egg-yolk", "mushroom-shiitake", "cod"],
      reason: (g) => `VDR FokI (${g}) — récepteur vitamine D moins efficace. Maintenir 25(OH)D vers haut de la cible (60-80 ng/mL).` },
  },
  {
    rsid: "rs7041", benefit: "Vitamine D", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "egg-yolk", "mushroom-shiitake"],
      reason: (g) => `GC (${g}) — transport vitamine D moins efficace. Apports plus élevés requis pour atteindre cible sanguine.` },
  },

  // === HFE — hémochromatose ===
  {
    rsid: "rs1799945", benefit: "Fer", priority: "high",
    matchGenotypes: ["GG", "CG"],
    avoid: { foodSlugs: ["liver-beef", "liver-chicken", "beef-grass-fed", "lamb", "oysters", "mussels"],
      reason: (g) => `HFE H63D (${g}) — absorption fer accrue. Modérer abats et viandes rouges, surveiller ferritine.` },
    favor: { foodSlugs: ["green-tea", "matcha", "coffee-black"],
      reason: (g) => `HFE H63D (${g}) — tanins du thé/café réduisent absorption fer. À consommer avec les repas.` },
  },
  {
    rsid: "rs1800562", benefit: "Fer", priority: "high",
    matchGenotypes: ["AA", "AG"],
    avoid: { foodSlugs: ["liver-beef", "liver-chicken", "beef-grass-fed", "lamb", "oysters", "mussels", "supplemented-folic-acid"],
      reason: (g) => `HFE C282Y (${g}) — mutation hémochromatose. Bilan fer annuel impératif. Éviter abats + suppléments fer.` },
    favor: { foodSlugs: ["green-tea", "coffee-black"],
      reason: (g) => `HFE C282Y (${g}) — tanins limitent absorption fer. Boire avec repas riches en fer.` },
  },

  // === FADS1/2 oméga-3 conversion ===
  {
    rsid: "rs174537", benefit: "Oméga-3", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "mackerel", "anchovies", "herring"],
      reason: (g) => `FADS1 (${g}) — conversion ALA→EPA/DHA réduite. EPA/DHA marin direct préférable au lin/chia.` },
    avoid: { foodSlugs: ["seed-oils-industrial"],
      reason: (g) => `FADS1 (${g}) — huiles oméga-6 industrielles déséquilibrent ratio ω6/ω3.` },
  },
  {
    rsid: "rs1535", benefit: "Oméga-3", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "mackerel"],
      reason: (g) => `FADS2 (${g}) — désaturase ralentie. EPA/DHA poisson > précurseurs végétaux.` },
  },

  // === PEMT choline ===
  {
    rsid: "rs7946", benefit: "Choline", priority: "moderate",
    matchGenotypes: ["AA"],
    favor: { foodSlugs: ["egg-pasture", "egg-yolk", "liver-beef", "liver-chicken", "salmon-wild"],
      reason: (g) => `PEMT (${g}) — synthèse endogène choline réduite (surtout pré-ménopause). Œufs et abats prioritaires.` },
  },

  // === BCMO1 β-carotène ===
  {
    rsid: "rs7501331", benefit: "Vitamine A", priority: "moderate",
    matchGenotypes: ["TT", "CT"],
    favor: { foodSlugs: ["liver-beef", "liver-chicken", "egg-yolk", "salmon-wild", "butter-grass-fed"],
      reason: (g) => `BCMO1 (${g}) — conversion β-carotène→rétinol réduite. Privilégier vitamine A préformée (rétinol) des animaux.` },
  },
  {
    rsid: "rs12934922", benefit: "Vitamine A", priority: "info",
    matchGenotypes: ["AA"],
    favor: { foodSlugs: ["liver-beef", "egg-yolk", "butter-grass-fed"],
      reason: (g) => `BCMO1 (${g}) — variant complémentaire de baisse de conversion. Idem: rétinol direct préféré.` },
  },

  // === COMT — catécholamines (lien caféine + thé vert) ===
  {
    rsid: "rs4680", benefit: "Stress / Cognition", priority: "moderate",
    matchGenotypes: ["AA"],
    avoid: { foodSlugs: ["coffee-black", "matcha"],
      reason: (g) => `COMT Met/Met (${g}) — dégradation lente catécholamines. Sensible à caféine (anxiété, insomnie). Limiter et privilégier théanine.` },
    favor: { foodSlugs: ["green-tea", "dark-chocolate"],
      reason: (g) => `COMT Met/Met (${g}) — théanine du thé module COMT, magnésium du chocolat noir apaise.` },
  },

  // === ADRB2/ADRB3 — métabolisme adipeux ===
  {
    rsid: "rs1042713", benefit: "Métabolique", priority: "info",
    matchGenotypes: ["AA"],
    favor: { foodSlugs: ["salmon-wild", "broccoli", "olive-oil-evoo", "almonds"],
      reason: (g) => `ADRB2 Arg16Gly (${g}) — sensibilité accrue aux glucides. Régime modéré en glucides + bons lipides.` },
  },
  {
    rsid: "rs4994", benefit: "Métabolique", priority: "info",
    matchGenotypes: ["GG", "AG"],
    favor: { foodSlugs: ["salmon-wild", "olive-oil-evoo", "broccoli"],
      reason: (g) => `ADRB3 Trp64Arg (${g}) — lipolyse réduite. Activité physique régulière + protéines + bons lipides.` },
  },

  // === TNF / IL6 — inflammaging ===
  {
    rsid: "rs1800629", benefit: "Anti-inflammatoire", priority: "moderate",
    matchGenotypes: ["AA", "AG"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "turmeric", "ginger", "blueberry", "olive-oil-evoo", "green-tea", "broccoli"],
      reason: (g) => `TNF-α -308G/A (${g}) — terrain pro-inflammatoire. Régime anti-inflammatoire systématique.` },
    avoid: { foodSlugs: ["seed-oils-industrial", "sugar-white", "ultraprocessed-snacks", "fast-food"],
      reason: (g) => `TNF-α (${g}) — éviter pro-inflammatoires industriels (huiles ω6, sucre, ultra-transformés).` },
  },
  {
    rsid: "rs1800795", benefit: "Anti-inflammatoire", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["salmon-wild", "olive-oil-evoo", "blueberry", "turmeric"],
      reason: (g) => `IL-6 -174G/C (${g}) — production IL-6 plus élevée. Aliments anti-inflammatoires + activité physique.` },
  },

  // === SOD2 — stress oxydatif ===
  {
    rsid: "rs4880", benefit: "Antioxydant", priority: "moderate",
    matchGenotypes: ["TT"],
    favor: { foodSlugs: ["broccoli", "broccoli-sprouts", "blueberry", "pomegranate", "green-tea", "dark-chocolate", "brazil-nuts"],
      reason: (g) => `SOD2 Val16Ala (${g}) — défenses antioxydantes mitochondriales réduites. Polyphénols, sulforaphane, sélénium critiques.` },
  },

  // === TAS2R38 — perception amer (crucifères) ===
  {
    rsid: "rs1726866", benefit: "Crucifères", priority: "info",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["broccoli", "kale", "brussels-sprouts", "cauliflower", "arugula"],
      reason: (g) => `TAS2R38 (${g}) — moindre sensibilité à l'amertume. Probabilité élevée d'apprécier les crucifères, en profiter.` },
  },

  // === Lp(a) génétique ===
  {
    rsid: "rs10455872", benefit: "Cardio-vasculaire", priority: "high",
    matchGenotypes: ["AG", "GG"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "olive-oil-evoo", "almonds", "broccoli"],
      reason: (g) => `LPA (${g}) — Lp(a) élevée génétique. La Lp(a) ne se modifie pas par diet, mais réduire LDL/inflammation reste protecteur.` },
    avoid: { foodSlugs: ["fast-food", "processed-meat", "ultraprocessed-snacks", "seed-oils-industrial"],
      reason: (g) => `LPA (${g}) — terrain à risque, éviter facteurs additionnels (trans, ultra-transformés).` },
  },
  {
    rsid: "rs3798220", benefit: "Cardio-vasculaire", priority: "high",
    matchGenotypes: ["CT", "TT"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "olive-oil-evoo"],
      reason: (g) => `LPA (${g}) — variant Lp(a) majeur. Stratégie identique LDL/inflammation low.` },
  },

  // === 9p21 coronaire ===
  {
    rsid: "rs10757274", benefit: "Cardio-vasculaire", priority: "moderate",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["salmon-wild", "olive-oil-evoo", "broccoli", "kale", "blueberry", "almonds"],
      reason: (g) => `9p21 (${g}) — risque coronaire majoré. Régime méditerranéen et activité physique réduisent fortement le risque.` },
    avoid: { foodSlugs: ["processed-meat", "fast-food", "seed-oils-industrial"],
      reason: (g) => `9p21 (${g}) — éviter facteurs pro-athérogènes additionnels.` },
  },

  // === FV / Prothrombin — thrombose ===
  {
    rsid: "rs6025", benefit: "Coagulation", priority: "high",
    matchGenotypes: ["AA", "AG"],
    favor: { foodSlugs: ["salmon-wild", "sardines", "garlic", "ginger", "turmeric", "water-mineral"],
      reason: (g) => `Facteur V Leiden (${g}) — risque thrombotique. Hydratation, oméga-3 et anti-inflammatoires (sans antiagrégants automatiques).` },
  },
  {
    rsid: "rs1799963", benefit: "Coagulation", priority: "high",
    matchGenotypes: ["AA", "AG"],
    favor: { foodSlugs: ["salmon-wild", "garlic", "ginger", "water-mineral"],
      reason: (g) => `Prothrombine G20210A (${g}) — risque thrombose 2-3x. Hydratation + anti-inflammatoires.` },
  },

  // === KLOTHO ===
  {
    rsid: "rs9536314", benefit: "Longévité", priority: "info",
    matchGenotypes: ["GT"],
    favor: { foodSlugs: ["salmon-wild", "broccoli", "olive-oil-evoo", "blueberry", "dark-chocolate"],
      reason: (g) => `KLOTHO KL-VS (${g}) — variant pro-longévité. Soutenir avec régime méditerranéen et antioxydants.` },
  },

  // === FOXO3 ===
  {
    rsid: "rs2802292", benefit: "Longévité", priority: "info",
    matchGenotypes: ["GG", "GT"],
    favor: { foodSlugs: ["broccoli", "kale", "salmon-wild", "olive-oil-evoo", "green-tea"],
      reason: (g) => `FOXO3 (${g}) — variant longévité. Activité physique et restriction calorique modérée potentialisent l'effet.` },
  },

  // === GST / NQO1 / detox ===
  {
    rsid: "rs1695", benefit: "Détoxification", priority: "moderate",
    matchGenotypes: ["AG", "GG"],
    favor: { foodSlugs: ["broccoli", "broccoli-sprouts", "cauliflower", "garlic", "kale", "watercress"],
      reason: (g) => `GSTP1 (${g}) — détoxification phase II altérée. Crucifères et sulforaphane induisent enzymes détox.` },
  },

  // === Salt sensitivity (générique via 9p21 / autres) ===
  // (couvert par 9p21 ci-dessus)

  // === MAOA ===
  {
    rsid: "rs6323", benefit: "Stress / Humeur", priority: "info",
    matchGenotypes: ["TT"],
    favor: { foodSlugs: ["salmon-wild", "egg-pasture", "spinach", "dark-chocolate"],
      reason: (g) => `MAOA-H (${g}) — dégradation rapide neurotransmetteurs. Tyrosine + B6 + magnésium soutiennent dopamine.` },
  },

  // === IGF / IIS ===
  {
    rsid: "rs2854744", benefit: "Longévité", priority: "info",
    matchGenotypes: ["AA"],
    favor: { foodSlugs: ["broccoli", "lentils-green", "olive-oil-evoo"],
      reason: (g) => `IGFBP3 (${g}) — modulation IGF-1. Régime modéré en protéines animales et jeûne intermittent abaissent IGF-1.` },
  },

  // === ADIPOQ — adiponectine ===
  {
    rsid: "rs17300539", benefit: "Métabolique", priority: "info",
    matchGenotypes: ["GG"],
    favor: { foodSlugs: ["salmon-wild", "olive-oil-evoo", "almonds", "avocado"],
      reason: (g) => `ADIPOQ (${g}) — adiponectine plus basse, sensibilité insuline réduite. Bons lipides et perte de gras viscéral relèvent l'adiponectine.` },
  },

  // === PNPLA3 — stéatose ===
  {
    rsid: "rs738409", benefit: "Foie", priority: "moderate",
    matchGenotypes: ["GG", "CG"],
    favor: { foodSlugs: ["broccoli", "olive-oil-evoo", "green-tea", "salmon-wild", "turmeric", "garlic"],
      reason: (g) => `PNPLA3 (${g}) — risque stéatose hépatique majoré. Méditerranéen + low-carb + activité physique = stratégie n°1.` },
    avoid: { foodSlugs: ["alcohol", "wine-red", "beer", "fruit-juice", "soda-sugary", "high-fructose-corn-syrup"],
      reason: (g) => `PNPLA3 (${g}) — fructose et alcool catastrophiques. Éliminer en priorité.` },
  },

  // === SLC30A8 — zinc/insuline ===
  {
    rsid: "rs13266634", benefit: "Glycémie", priority: "info",
    matchGenotypes: ["CC"],
    favor: { foodSlugs: ["oysters", "pumpkin-seeds", "beef-grass-fed", "egg-pasture"],
      reason: (g) => `SLC30A8 (${g}) — zinc insulaire suboptimal. Apports zinc adéquats soutiennent sécrétion insuline.` },
  },

  // === NOS3 — endothélium ===
  {
    rsid: "rs1799983", benefit: "Cardio-vasculaire", priority: "moderate",
    matchGenotypes: ["TT"],
    favor: { foodSlugs: ["beetroot", "spinach", "arugula", "watercress", "dark-chocolate", "pomegranate"],
      reason: (g) => `NOS3 (${g}) — production NO réduite. Aliments riches en nitrates (betterave, légumes verts) restaurent NO endothélial.` },
  },

  // === LCT/MCM6 lactose ===
  {
    rsid: "rs4988235", benefit: "Lactose", priority: "moderate",
    matchGenotypes: ["GG"],
    avoid: { foodSlugs: ["milk-cow", "cheese-fresh"],
      reason: (g) => `MCM6 (${g}) — non-persistance lactase. Lait et fromages frais souvent mal tolérés. Préférer affinés ou alternatives.` },
    favor: { foodSlugs: ["yogurt-greek", "kefir", "cheese-aged"],
      reason: (g) => `MCM6 (${g}) — yaourts/kéfir/fromages affinés contiennent peu de lactose résiduel.` },
  },
];

export const DNA_RULES_BY_RSID: Record<string, DnaRule> = Object.fromEntries(DNA_RULES.map((r) => [r.rsid, r]));

function categoryToHref(cat: string): string {
  // Map dna_insight category to /dna/[category] route
  const c = cat.toLowerCase();
  if (c.includes("nutri")) return "/dna/nutrition";
  if (c.includes("longev")) return "/dna/longevity";
  if (c.includes("cardio")) return "/dna/cardiovascular";
  if (c.includes("metab")) return "/dna/metabolism";
  if (c.includes("cogn")) return "/dna/cognitive";
  if (c.includes("hormon")) return "/dna/hormones";
  if (c.includes("immun")) return "/dna/immunity";
  if (c.includes("detox")) return "/dna/detox";
  if (c.includes("fitness")) return "/dna/fitness";
  return "/dna";
}

export function applyDnaRules(insights: DnaInsightRow[]): RuleHit[] {
  const hits: RuleHit[] = [];
  const byRsid = new Map<string, DnaInsightRow>();
  for (const i of insights) byRsid.set(i.rsid, i);

  for (const rule of DNA_RULES) {
    const insight = byRsid.get(rule.rsid);
    if (!insight) continue;
    if (!insight.userGenotype) continue;
    const sortedG = insight.userGenotype.split("").sort().join("");
    if (!rule.matchGenotypes.some((g) => g.split("").sort().join("") === sortedG)) continue;

    const href = categoryToHref(insight.category);
    if (rule.favor) {
      hits.push({
        source: "dna", ruleKey: `${rule.rsid}:favor`, subject: rule.rsid, subjectLabel: insight.trait,
        reason: rule.favor.reason(insight.userGenotype), benefit: rule.benefit, priority: rule.priority,
        action: "favor", foodSlugs: rule.favor.foodSlugs, href,
      });
    }
    if (rule.avoid) {
      hits.push({
        source: "dna", ruleKey: `${rule.rsid}:avoid`, subject: rule.rsid, subjectLabel: insight.trait,
        reason: rule.avoid.reason(insight.userGenotype), benefit: rule.benefit, priority: rule.priority,
        action: "avoid", foodSlugs: rule.avoid.foodSlugs, href,
      });
    }
  }
  return hits;
}

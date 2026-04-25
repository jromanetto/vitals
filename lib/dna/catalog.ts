/**
 * Curated DNA insight catalog. Each entry maps an rsid to a trait, the risk allele,
 * the effect direction, and a short summary. Sources: SNPedia (CC-BY-SA 3.0),
 * ClinVar, dbSNP, peer-reviewed literature.
 *
 * The autonomous improvement agent expands this catalog over time.
 */

export type CatalogEntry = {
  rsid: string;
  category: "cardiovascular" | "metabolism" | "longevity" | "nutrition" | "fitness" | "cognitive" | "hormones" | "immunity" | "detox" | "carriers";
  trait: string;
  /**
   * Risk genotype OR a function returning hasRisk + effect text given user genotype.
   * Use simple uppercase 1- or 2-letter genotypes (e.g., "TT", "AG").
   */
  riskGenotypes: string[];
  effect?: string;
  summary: string;
  source: string;
  magnitude?: number;
};

export const CATALOG: CatalogEntry[] = [
  {
    rsid: "rs429358", category: "longevity", trait: "APOE — Alzheimer / longevity",
    riskGenotypes: ["CC", "CT"], magnitude: 4,
    effect: "L'allèle C (ε4) augmente le risque d'Alzheimer et de maladies cardiovasculaires.",
    summary: "APOE est le gène le plus important pour le risque d'Alzheimer tardif. ε4/ε4 multiplie le risque par ~10. ε2 protège.",
    source: "https://www.snpedia.com/index.php/Rs429358",
  },
  {
    rsid: "rs7412", category: "longevity", trait: "APOE — variant ε2 protecteur",
    riskGenotypes: ["CC"], magnitude: 2,
    effect: "Combiné à rs429358, détermine ε2/ε3/ε4. Allèle T = ε2 (protecteur).",
    summary: "rs7412(T) avec rs429358(T) = ε2, associé à une longévité accrue et un cholestérol plus bas.",
    source: "https://www.snpedia.com/index.php/Rs7412",
  },
  {
    rsid: "rs1801133", category: "nutrition", trait: "MTHFR C677T — methylation",
    riskGenotypes: ["TT", "CT"], magnitude: 3,
    effect: "L'allèle T réduit l'activité de la MTHFR de 30-70%, augmentant l'homocystéine.",
    summary: "Important pour la méthylation et le métabolisme des folates. Les porteurs TT bénéficient de méthylfolate plutôt qu'acide folique.",
    source: "https://www.snpedia.com/index.php/Rs1801133",
  },
  {
    rsid: "rs762551", category: "nutrition", trait: "CYP1A2 — métabolisme caféine",
    riskGenotypes: ["CC", "AC"], magnitude: 2,
    effect: "Allèle C = métaboliseur lent de la caféine. Risque cardiovasculaire majoré si >2 cafés/jour.",
    summary: "AA = fast metabolizer (caféine OK). AC ou CC = slow, augmente le risque d'infarctus avec consommation élevée.",
    source: "https://www.snpedia.com/index.php/Rs762551",
  },
  {
    rsid: "rs4988235", category: "nutrition", trait: "Persistance lactase",
    riskGenotypes: ["GG"], magnitude: 3,
    effect: "GG = intolérance au lactose probable. AG/AA = persistance lactase (digestion lait OK).",
    summary: "Le SNP majeur pour la tolérance au lactose chez les Européens. Population du Nord majoritairement A.",
    source: "https://www.snpedia.com/index.php/Rs4988235",
  },
  {
    rsid: "rs1815739", category: "fitness", trait: "ACTN3 — fibres rapides",
    riskGenotypes: ["TT"], magnitude: 2,
    effect: "TT = absence d'α-actinine-3, fibres rapides moins efficaces. Avantage endurance.",
    summary: "Le 'speed gene'. CC = sprinter, TT = endurance, CT = mixte. Influence force explosive et risque blessure.",
    source: "https://www.snpedia.com/index.php/Rs1815739",
  },
  {
    rsid: "rs1042713", category: "fitness", trait: "ADRB2 — réponse adrénergique",
    riskGenotypes: ["AA"], magnitude: 1,
    effect: "Influence la réponse cardiovasculaire à l'effort.",
    summary: "ADRB2 module la lipolyse et la dilatation bronchique pendant l'exercice.",
    source: "https://www.snpedia.com/index.php/Rs1042713",
  },
  {
    rsid: "rs6265", category: "cognitive", trait: "BDNF Val66Met",
    riskGenotypes: ["TT", "CT"], magnitude: 2,
    effect: "L'allèle T (Met) réduit la sécrétion de BDNF, affectant mémoire et plasticité.",
    summary: "BDNF favorise la neurogenèse. Val/Val (CC) = mémoire optimale, Met carrier = sensibilité accrue au stress.",
    source: "https://www.snpedia.com/index.php/Rs6265",
  },
  {
    rsid: "rs4680", category: "cognitive", trait: "COMT Val158Met — dopamine",
    riskGenotypes: ["AA"], magnitude: 2,
    effect: "AA (Met/Met) = COMT lente, plus de dopamine préfrontale. Avantage cognitif mais sensibilité au stress accrue.",
    summary: "Le 'warrior vs worrier' gene. GG = warrior (résilience, focus sous stress). AA = worrier (créatif au calme, débordé sous stress).",
    source: "https://www.snpedia.com/index.php/Rs4680",
  },
  {
    rsid: "rs53576", category: "cognitive", trait: "OXTR — récepteur ocytocine",
    riskGenotypes: ["AA"], magnitude: 1,
    effect: "AA = empathie réduite, AG/GG = empathie accrue.",
    summary: "Influence l'empathie, l'attachement et la régulation du stress social.",
    source: "https://www.snpedia.com/index.php/Rs53576",
  },
  {
    rsid: "rs9939609", category: "metabolism", trait: "FTO — obésité",
    riskGenotypes: ["AA", "AT"], magnitude: 3,
    effect: "L'allèle A augmente le risque d'obésité de 20-30% par allèle.",
    summary: "Le SNP le mieux établi pour l'obésité. Effet largement compensé par l'exercice régulier.",
    source: "https://www.snpedia.com/index.php/Rs9939609",
  },
  {
    rsid: "rs7903146", category: "metabolism", trait: "TCF7L2 — diabète T2",
    riskGenotypes: ["TT", "CT"], magnitude: 3,
    effect: "L'allèle T augmente le risque de diabète T2 de ~40% par allèle.",
    summary: "Le marqueur génétique le plus fort du diabète T2. Affecte la sécrétion d'insuline.",
    source: "https://www.snpedia.com/index.php/Rs7903146",
  },
  {
    rsid: "rs1801282", category: "metabolism", trait: "PPARG Pro12Ala",
    riskGenotypes: ["CC"], magnitude: 1,
    effect: "CC (Pro/Pro) = risque DT2 légèrement accru. CG/GG (Ala carrier) = protecteur.",
    summary: "Ala12 améliore la sensibilité à l'insuline. Effet modulé par les acides gras alimentaires.",
    source: "https://www.snpedia.com/index.php/Rs1801282",
  },
  {
    rsid: "rs1799945", category: "metabolism", trait: "HFE H63D — hémochromatose",
    riskGenotypes: ["GG", "CG"], magnitude: 2,
    effect: "Allèle G augmente l'absorption du fer. GG ou C282Y/H63D composite = risque hémochromatose.",
    summary: "Une des deux mutations principales de l'hémochromatose. Surveiller ferritine si porteur.",
    source: "https://www.snpedia.com/index.php/Rs1799945",
  },
  {
    rsid: "rs1800562", category: "metabolism", trait: "HFE C282Y — hémochromatose majeure",
    riskGenotypes: ["AA", "AG"], magnitude: 4,
    effect: "Mutation principale de l'hémochromatose. AA = phénotype quasi-certain.",
    summary: "Mutation à pénétrance variable. Surveillance fer/ferritine/saturation transferrine recommandée.",
    source: "https://www.snpedia.com/index.php/Rs1800562",
  },
  {
    rsid: "rs6025", category: "cardiovascular", trait: "Facteur V Leiden — thrombose",
    riskGenotypes: ["AA", "AG"], magnitude: 4,
    effect: "Allèle A = mutation Leiden. Augmente le risque de thrombose veineuse 5-10x (hétérozygote) à 50-80x (homozygote).",
    summary: "Mutation thrombophile la plus commune. Vigilance avec contraceptifs œstrogéniques, immobilisation, vols longs.",
    source: "https://www.snpedia.com/index.php/Rs6025",
  },
  {
    rsid: "rs1799963", category: "cardiovascular", trait: "Prothrombine G20210A — thrombose",
    riskGenotypes: ["AA", "AG"], magnitude: 3,
    effect: "Allèle A augmente le risque de thrombose veineuse 2-3x (hétérozygote).",
    summary: "Deuxième mutation thrombophile la plus fréquente. Cumulé avec Facteur V Leiden = risque majoré.",
    source: "https://www.snpedia.com/index.php/Rs1799963",
  },
  {
    rsid: "rs10757274", category: "cardiovascular", trait: "9p21 — risque coronarien",
    riskGenotypes: ["GG"], magnitude: 2,
    effect: "GG augmente le risque d'infarctus du myocarde de ~30%.",
    summary: "Région 9p21 = signal GWAS le plus fort pour la maladie coronarienne. Effet indépendant des lipides.",
    source: "https://www.snpedia.com/index.php/Rs10757274",
  },
  {
    rsid: "rs662", category: "cardiovascular", trait: "PON1 — détoxification organophosphorés",
    riskGenotypes: ["GG"], magnitude: 1,
    effect: "GG = activité paraoxonase réduite, sensibilité accrue aux pesticides.",
    summary: "Influence la sensibilité aux organophosphorés et le risque cardiovasculaire (HDL antioxydant).",
    source: "https://www.snpedia.com/index.php/Rs662",
  },
  {
    rsid: "rs1799853", category: "detox", trait: "CYP2C9*2 — métabolisme warfarine/AINS",
    riskGenotypes: ["TT", "CT"], magnitude: 2,
    effect: "Réduit le métabolisme de la warfarine, ibuprofène, losartan.",
    summary: "Pharmacogenomic important pour AVK et certains AINS. Doses plus faibles requises.",
    source: "https://www.snpedia.com/index.php/Rs1799853",
  },
  {
    rsid: "rs9923231", category: "detox", trait: "VKORC1 — sensibilité warfarine",
    riskGenotypes: ["TT"], magnitude: 3,
    effect: "TT = sensibilité forte à la warfarine, doses très faibles.",
    summary: "Critique pour l'ajustement de la warfarine. Combiné à CYP2C9 pour le dosage.",
    source: "https://www.snpedia.com/index.php/Rs9923231",
  },
  {
    rsid: "rs2231142", category: "detox", trait: "ABCG2 — métabolisme acide urique / médicaments",
    riskGenotypes: ["TT", "GT"], magnitude: 2,
    effect: "T = transport réduit de l'urate, risque goutte accru.",
    summary: "Affecte la clairance d'urate et de plusieurs médicaments (statines, antiviraux).",
    source: "https://www.snpedia.com/index.php/Rs2231142",
  },
  {
    rsid: "rs2228671", category: "cardiovascular", trait: "LDLR — sensibilité statines",
    riskGenotypes: ["CC"], magnitude: 1,
    effect: "T = LDL plus bas naturellement, meilleure réponse aux statines.",
    summary: "Variant du récepteur LDL. Influence le LDL basal et la réponse thérapeutique.",
    source: "https://www.snpedia.com/index.php/Rs2228671",
  },
  {
    rsid: "rs2802292", category: "longevity", trait: "FOXO3 — longévité",
    riskGenotypes: ["TT"], magnitude: 2,
    effect: "G = associé à longévité accrue (centenaires).",
    summary: "Un des rares SNPs validés pour la longévité humaine extrême. Effet via résistance au stress oxydatif.",
    source: "https://www.snpedia.com/index.php/Rs2802292",
  },
  {
    rsid: "rs1042522", category: "longevity", trait: "TP53 codon 72",
    riskGenotypes: ["GG"], magnitude: 1,
    effect: "Pro/Pro (GG) = longévité légèrement accrue mais réponse apoptotique réduite.",
    summary: "Trade-off cancer/longévité. Pro = longévité, Arg = meilleure réponse anti-tumorale.",
    source: "https://www.snpedia.com/index.php/Rs1042522",
  },
  {
    rsid: "rs1801131", category: "nutrition", trait: "MTHFR A1298C",
    riskGenotypes: ["GG"], magnitude: 1,
    effect: "GG = activité MTHFR réduite, à combiner avec C677T.",
    summary: "Deuxième variant MTHFR clinique. Effet additif avec rs1801133.",
    source: "https://www.snpedia.com/index.php/Rs1801131",
  },
  {
    rsid: "rs2187668", category: "immunity", trait: "HLA-DQ2.5 — coeliakie",
    riskGenotypes: ["AA", "AG"], magnitude: 3,
    effect: "Allèle A = HLA-DQ2.5, prérequis génétique de la maladie cœliaque.",
    summary: "~95% des cœliaques portent DQ2.5. Absence = exclusion presque totale du risque.",
    source: "https://www.snpedia.com/index.php/Rs2187668",
  },
  {
    rsid: "rs7574865", category: "immunity", trait: "STAT4 — auto-immunité",
    riskGenotypes: ["TT"], magnitude: 1,
    effect: "T = risque accru de lupus, polyarthrite rhumatoïde.",
    summary: "STAT4 module la réponse Th1/Th17. Variant impliqué dans plusieurs maladies auto-immunes.",
    source: "https://www.snpedia.com/index.php/Rs7574865",
  },
  {
    rsid: "rs10830963", category: "metabolism", trait: "MTNR1B — glycémie / mélatonine",
    riskGenotypes: ["GG"], magnitude: 1,
    effect: "G = glycémie à jeun plus élevée, perturbation de la sécrétion d'insuline nocturne.",
    summary: "Lien entre rythme circadien et métabolisme du glucose. Influence le risque de DT2 et de diabète gestationnel.",
    source: "https://www.snpedia.com/index.php/Rs10830963",
  },
  {
    rsid: "rs17782313", category: "metabolism", trait: "MC4R — appétit",
    riskGenotypes: ["CC"], magnitude: 1,
    effect: "C = appétit augmenté, prise alimentaire accrue.",
    summary: "MC4R régule la satiété. Variant fréquent associé à un IMC plus élevé.",
    source: "https://www.snpedia.com/index.php/Rs17782313",
  },
  {
    rsid: "rs1799752", category: "fitness", trait: "ACE I/D — endurance",
    riskGenotypes: [],
    effect: "I/I = meilleure endurance. D/D = meilleure puissance.",
    summary: "Premier 'gène du sport'. Variant insertion/délétion non capturé par 23andMe v4 directement.",
    source: "https://www.snpedia.com/index.php/Rs1799752",
  },
];

export function evaluate(catalog: CatalogEntry, userGenotype: string): { hasRisk: boolean; userGenotype: string } {
  if (!userGenotype || userGenotype.length < 2) return { hasRisk: false, userGenotype };
  const sorted = userGenotype.split("").sort().join("");
  const sortedRisk = catalog.riskGenotypes.map((g) => g.split("").sort().join(""));
  return { hasRisk: sortedRisk.includes(sorted), userGenotype };
}

/**
 * Built-in drug-supplement interaction checker.
 * Conservative list — flags only well-established interactions.
 */

export type Interaction = {
  level: "high" | "moderate" | "info";
  pair: [string, string];
  effect: string;
  recommendation: string;
};

// Each entry: keywords found in supplement.name OR profile.medications, mapped to a list of conflicts
type Rule = {
  match: string[];                  // case-insensitive substring matchers (any matches the source)
  conflictsWith: string[];          // case-insensitive substring matchers for the target
  level: Interaction["level"];
  effect: string;
  recommendation: string;
};

const RULES: Rule[] = [
  // Vitamine K vs anticoagulants
  { match: ["vitamine k", "vit k", "vitamin k", "k2", "mk7", "ménaquinone"],
    conflictsWith: ["warfarine", "warfarin", "coumadine", "coumadin", "previscan", "sintrom", "fluindione", "acénocoumarol"],
    level: "high",
    effect: "La vitamine K antagonise l'effet des antivitamines K (AVK). Risque de réduction de l'INR et de thrombose.",
    recommendation: "Garder un apport stable de vit K (ne pas démarrer/arrêter brusquement). Surveillance INR rapprochée si modification." },

  // Oméga-3 high-dose vs anticoagulants/antiplaquettaires
  { match: ["oméga", "omega", "fish oil", "huile de poisson", "epa", "dha"],
    conflictsWith: ["warfarine", "warfarin", "coumadine", "aspirine", "aspirin", "kardégic", "clopidogrel", "plavix", "ticagrelor", "rivaroxaban", "xarelto", "apixaban", "eliquis"],
    level: "moderate",
    effect: "Les oméga-3 à forte dose (>3 g/j) peuvent potentialiser l'effet antithrombotique → saignements.",
    recommendation: "Si dose > 2 g EPA+DHA/j et anticoagulant : avis médecin. Surveiller saignements/ecchymoses." },

  // St John's wort vs ISRS, contraceptifs, anticoagulants, ciclosporine
  { match: ["millepertuis", "st john", "hypericum"],
    conflictsWith: ["sertraline", "fluoxétine", "paroxétine", "escitalopram", "citalopram", "venlafaxine", "duloxétine", "tramadol", "warfarine", "ciclosporine", "tacrolimus", "ethinylestradiol", "contraceptif", "lévonorgestrel", "désogestrel"],
    level: "high",
    effect: "Inducteur enzymatique majeur (CYP3A4) → réduit l'efficacité de nombreux médicaments. Risque syndrome sérotoninergique avec ISRS.",
    recommendation: "À éviter avec antidépresseurs, contraceptifs oraux, anticoagulants, immunosuppresseurs." },

  // Niacine high-dose vs statines
  { match: ["niacine", "niacin", "nicotinamide", "vit pp", "b3 nicotin"],
    conflictsWith: ["statin", "atorvastatine", "rosuvastatine", "simvastatine", "pravastatine"],
    level: "moderate",
    effect: "Niacine à forte dose (>1g) + statine → risque accru de myopathie/rhabdomyolyse.",
    recommendation: "Surveiller CK et symptômes musculaires. Limiter dose si possible." },

  // Calcium vs lévothyroxine
  { match: ["calcium"],
    conflictsWith: ["lévothyroxine", "levothyroxine", "lévothyrox", "thyroxine"],
    level: "moderate",
    effect: "Le calcium réduit l'absorption de la lévothyroxine.",
    recommendation: "Espacer la prise d'au moins 4 heures." },

  // Fer vs lévothyroxine, IPP, antibiotiques
  { match: ["fer ", "iron", "bisglycinate de fer", "ferrochel", "sulfate ferreux"],
    conflictsWith: ["lévothyroxine", "levothyroxine", "lévothyrox", "ciprofloxacine", "fluoroquinolone", "tétracycline", "doxycycline", "oméprazole", "esomeprazole", "ipp"],
    level: "moderate",
    effect: "Le fer réduit l'absorption des hormones thyroïdiennes, antibiotiques et est lui-même moins absorbé sous IPP.",
    recommendation: "Prendre le fer à distance (2-4h) des autres médicaments. Vit C améliore son absorption." },

  // Magnésium vs antibiotiques
  { match: ["magnésium", "magnesium"],
    conflictsWith: ["ciprofloxacine", "fluoroquinolone", "tétracycline", "doxycycline", "azithromycine"],
    level: "info",
    effect: "Le magnésium chélate certains antibiotiques.",
    recommendation: "Espacer de 2-4 heures." },

  // CoQ10 vs warfarine
  { match: ["coq10", "coenzyme q10", "ubiquinone", "ubiquinol"],
    conflictsWith: ["warfarine", "coumadine"],
    level: "info",
    effect: "Légère diminution potentielle de l'effet anticoagulant (effet vit K like).",
    recommendation: "Surveillance INR à l'introduction. Effet généralement modeste." },

  // Vitamine D high-dose long-term — info
  { match: ["vitamine d", "vitamin d", "calciférol", "cholécalciférol"],
    conflictsWith: ["thiazide", "hydrochlorothiazide", "indapamide", "digoxine"],
    level: "moderate",
    effect: "Vit D + thiazides → risque hypercalcémie. Vit D + digoxine → toxicité digitale possible si hypercalcémie.",
    recommendation: "Surveiller calcémie si association longue." },

  // Berbérine vs metformine, statines
  { match: ["berbérine", "berberine"],
    conflictsWith: ["metformine", "glimépiride", "atorvastatine", "rosuvastatine", "simvastatine", "ciclosporine"],
    level: "moderate",
    effect: "Berbérine inhibe CYP3A4, P-gp → augmente exposition aux statines/ciclosporine. Effet hypoglycémiant additif avec antidiabétiques.",
    recommendation: "Surveillance glycémie, CK musculaire. Espacer si possible." },

  // Tongkat Ali / Tribulus vs antidiabétiques, contraceptifs
  { match: ["tongkat", "tribulus", "fenugrec", "fenugreek"],
    conflictsWith: ["metformine", "insuline", "antidiabétique", "contraceptif"],
    level: "info",
    effect: "Effets adaptogènes/hormonaux peu prévisibles, hypoglycémiants potentiels.",
    recommendation: "Surveillance glycémie. Avis médecin." },
];

export function findInteractions(supplements: { name: string }[], medications: string[]): Interaction[] {
  const out: Interaction[] = [];
  const seen = new Set<string>();

  function lc(s: string) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function matches(text: string, patterns: string[]): boolean {
    const t = lc(text);
    return patterns.some((p) => t.includes(lc(p)));
  }

  // Supplement vs supplement
  for (let i = 0; i < supplements.length; i++) {
    for (let j = i + 1; j < supplements.length; j++) {
      for (const r of RULES) {
        if (matches(supplements[i].name, r.match) && matches(supplements[j].name, r.conflictsWith)) {
          const k = [supplements[i].name, supplements[j].name].sort().join("|");
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ level: r.level, pair: [supplements[i].name, supplements[j].name], effect: r.effect, recommendation: r.recommendation });
          }
        }
        if (matches(supplements[j].name, r.match) && matches(supplements[i].name, r.conflictsWith)) {
          const k = [supplements[i].name, supplements[j].name].sort().join("|");
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ level: r.level, pair: [supplements[j].name, supplements[i].name], effect: r.effect, recommendation: r.recommendation });
          }
        }
      }
    }
  }

  // Supplement vs medication
  for (const sup of supplements) {
    for (const med of medications) {
      for (const r of RULES) {
        if (matches(sup.name, r.match) && matches(med, r.conflictsWith)) {
          const k = `${sup.name}|${med}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ level: r.level, pair: [sup.name, med], effect: r.effect, recommendation: r.recommendation });
          }
        }
      }
    }
  }

  return out.sort((a, b) => {
    const order = { high: 0, moderate: 1, info: 2 };
    return order[a.level] - order[b.level];
  });
}

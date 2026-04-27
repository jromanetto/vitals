// Nutrient detection + matching between AI suggestions and user's active supplements.
// Used by /api/supplements/suggestions to mark suggestions as already covered.

const NUTRIENT_PATTERNS: { key: string; rx: RegExp }[] = [
  { key: "vitamin-d", rx: /\b(vitamin[ea]?\s*d|d3|cholecalciferol|calcitriol)\b/ },
  { key: "vitamin-k2", rx: /\b(k2|mk[\s-]?7|menaquinone)\b/ },
  { key: "vitamin-c", rx: /\b(vitamin[ea]?\s*c|ascorb)/ },
  { key: "vitamin-a", rx: /\b(vitamin[ea]?\s*a|retinol|cod[\s-]?liver)\b/ },
  { key: "vitamin-e", rx: /\b(vitamin[ea]?\s*e|tocopherol|tocotrienol)/ },
  { key: "b1", rx: /\b(b1\b|thiamin)/ },
  { key: "b2", rx: /\b(b2\b|riboflavin)/ },
  { key: "b3", rx: /\b(b3\b|niacin|nicotinamide|nmn)/ },
  { key: "b5", rx: /\b(b5\b|pantothenic|pantothenique)/ },
  { key: "b6", rx: /\b(b6\b|p5p|pyridoxal|pyridoxine)/ },
  { key: "b9", rx: /\b(folate|folic|mthf|methylfolate|b9\b|folates)/ },
  { key: "b12", rx: /\b(b[\s-]?12|cobalamin|methylcobalamin|hydroxocobalamin|cyanocobalamin)/ },
  { key: "biotin", rx: /\b(biotin|biotine|b8\b)/ },
  { key: "magnesium", rx: /\b(magnesium|magn[ée]sium)\b/ },
  { key: "iron", rx: /\b(iron|fer\b|ferrous|ferreux|bisglycinate de fer)/ },
  { key: "calcium", rx: /\b(calcium)\b/ },
  { key: "potassium", rx: /\b(potassium)\b/ },
  { key: "zinc", rx: /\b(zinc)\b/ },
  { key: "copper", rx: /\b(cuivre|copper)\b/ },
  { key: "manganese", rx: /\b(manganese|manganèse)/ },
  { key: "selenium", rx: /\b(selenium|sélénium|selenomethionine)/ },
  { key: "iodine", rx: /\b(iod[ie]ne?|iode|kelp|iodure)\b/ },
  { key: "chromium", rx: /\b(chromium|chrome)\b/ },
  { key: "molybdenum", rx: /\b(molybdenum|molybdène)/ },
  { key: "boron", rx: /\b(boron|bore)\b/ },
  { key: "lithium", rx: /\b(lithium orotate|lithium)\b/ },
  { key: "omega-3", rx: /\b(omega[\s-]?3|epa|dha|fish[\s-]?oil|huile de poisson|krill)/ },
  { key: "coq10", rx: /\b(co[\s-]?q[\s-]?10|ubiquin(?:ol|one)|coenzyme q)/ },
  { key: "nac", rx: /\b(nac\b|n[\s-]?acetyl[\s-]?cyst|acetylcyst)/ },
  { key: "glutathione", rx: /\b(glutathion)/ },
  { key: "glycine", rx: /\b(glycine)\b/ },
  { key: "taurine", rx: /\b(taurine)\b/ },
  { key: "creatine", rx: /\b(creatine|créatine)/ },
  { key: "theanine", rx: /\b(l[\s-]?theanine|théanine|theanine)\b/ },
  { key: "tyrosine", rx: /\b(l[\s-]?tyrosine|tyrosine)\b/ },
  { key: "leucine", rx: /\b(l[\s-]?leucine|leucine)\b/ },
  { key: "carnitine", rx: /\b(carnitine|alcar)\b/ },
  { key: "choline", rx: /\b(choline|alpha[\s-]?gpc|phosphatidylcholine|cdp[\s-]?choline|citicoline)\b/ },
  { key: "betaine", rx: /\b(betaine|bétaïne|tmg)\b/ },
  { key: "curcumin", rx: /\b(curcumin|turmeric|curcuma|meriva)/ },
  { key: "berberine", rx: /\b(berberin|berbérine)/ },
  { key: "bergamot", rx: /\b(bergamot|citrus bergamia)/ },
  { key: "sulforaphane", rx: /\b(sulforaphane|broccoli sprouts|brocoli)/ },
  { key: "tongkat", rx: /\b(tongkat|eurycoma)/ },
  { key: "ashwagandha", rx: /\b(ashwagandha|withania|ksm[\s-]?66)/ },
  { key: "rhodiola", rx: /\b(rhodiola)/ },
  { key: "ginseng", rx: /\b(ginseng)/ },
  { key: "resveratrol", rx: /\b(resveratrol|resvératrol)/ },
  { key: "quercetin", rx: /\b(quercetin|quercétine)/ },
  { key: "pqq", rx: /\bpqq\b/ },
  { key: "tudca", rx: /\btudca\b/ },
  { key: "hyaluronic", rx: /\b(hyaluron|acide hyaluronique)/ },
  { key: "lycopene", rx: /\b(lycopene|lycopène)/ },
  { key: "lutein", rx: /\b(lutein|lutéine)/ },
  { key: "astaxanthin", rx: /\b(astaxanthin|astaxanthine)/ },
  { key: "peppermint", rx: /\b(peppermint|menthe poivrée|ibgard)/ },
  { key: "psyllium", rx: /\b(psyllium)/ },
  { key: "butyrate", rx: /\b(butyrate)/ },
  { key: "probiotic", rx: /\b(probiot|lactobacillus|bifidobacterium|alflorex|lactibiane)/ },
  { key: "dhea", rx: /\b(dhea)/ },
  { key: "melatonin", rx: /\b(melatonin|mélatonine)/ },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function nutrientsFromText(text: string): Set<string> {
  const norm = normalize(text);
  const found = new Set<string>();
  for (const np of NUTRIENT_PATTERNS) {
    if (np.rx.test(norm)) found.add(np.key);
  }
  return found;
}

export type ActiveSup = {
  id: number;
  name: string;
  brand: string | null;
  ingredients: { name?: string }[] | null;
  nutrients: Set<string>;
};

export function buildActiveIndex(rows: Array<{ id: number; name: string; brand: string | null; ingredients: string | null; ended_at: number | null }>): ActiveSup[] {
  return rows
    .filter((r) => r.ended_at == null)
    .map((r) => {
      let parsed: { name?: string }[] | null = null;
      if (r.ingredients) { try { const p = JSON.parse(r.ingredients); if (Array.isArray(p)) parsed = p; } catch {} }
      const text = [r.name, r.brand ?? "", ...(parsed ?? []).map((i) => i.name ?? "")].join(" ");
      return { id: r.id, name: r.name, brand: r.brand, ingredients: parsed, nutrients: nutrientsFromText(text) };
    });
}

export function findCoverage(suggestionText: string, active: ActiveSup[]): { id: number; name: string; nutrient: string } | null {
  const wanted = nutrientsFromText(suggestionText);
  if (wanted.size === 0) return null;
  for (const sup of active) {
    for (const k of wanted) {
      if (sup.nutrients.has(k)) return { id: sup.id, name: sup.name, nutrient: k };
    }
  }
  return null;
}

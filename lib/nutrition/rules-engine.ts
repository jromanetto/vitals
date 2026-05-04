import { applyBiomarkerRules, type BiomarkerLatest } from "./catalog";
import { applyDnaRules, type DnaInsightRow } from "./dna-rules";
import { FOOD_BY_SLUG } from "./food-database";
import { DIET_PATTERNS, PATTERN_BY_KEY } from "./diet-patterns";
import type { NutritionPref, RuleHit } from "./types";

export type EngineInput = {
  biomarkers: BiomarkerLatest[];
  dna: DnaInsightRow[];
  prefs: NutritionPref;
};

export type EngineOutput = {
  rules: RuleHit[];
  /** Food slugs aggregated across favor rules, sorted by frequency × priority */
  favoredFoods: { slug: string; score: number; benefits: string[] }[];
  avoidFoods: { slug: string; score: number; benefits: string[] }[];
  suggestedPattern: { key: string; label: string; description: string; reason: string };
};

const PRIORITY_WEIGHT = { high: 3, moderate: 2, info: 1 } as const;

function normalizeGenotype(g: string): string {
  return g.split("").sort().join("");
}

/** Filter food list by user prefs (allergies, aversions, dietType compatibility). */
function isFoodAllowed(slug: string, prefs: NutritionPref): boolean {
  const food = FOOD_BY_SLUG[slug];
  if (!food) return false;

  // Diet type exclusions (food.excludedFor explicitly says diet types this food is incompatible with)
  if (food.excludedFor?.includes(prefs.dietType as never)) return false;

  // Vegetarian additional rule: no fish, no animal protein
  if (prefs.dietType === "vegetarian" && (food.category === "fish" || food.tags.includes("iron-heme"))) return false;
  if (prefs.dietType === "vegan" && (food.category === "fish" || food.category === "dairy" || food.category === "protein-animal" || food.tags.includes("iron-heme") || food.tags.includes("vitamin-b12") || food.tags.includes("lactose"))) {
    // permit egg-pasture? no — vegan = no animal products
    // But food-database already marks animal foods with excludedFor: ["vegan"]
    // Belt + suspenders: also re-check by category
    return false;
  }
  if (prefs.dietType === "pescatarian" && food.category === "protein-animal" && !food.tags.includes("vitamin-b12")) {
    // protein-animal includes meat — exclude. But egg-pasture is protein-animal too — keep eggs.
    if (food.slug !== "egg-pasture" && food.slug !== "egg-yolk") return false;
  }
  if (prefs.dietType === "keto" && (food.tags.includes("high-glycemic") || food.category === "grain" || food.category === "legume")) return false;
  if (prefs.dietType === "carnivore" && !["protein-animal", "fish", "dairy"].includes(food.category)) return false;

  // Allergies (allergy keys: gluten, lactose, nuts, eggs, soy, shellfish, fish)
  for (const a of prefs.allergies ?? []) {
    if (a === "gluten" && food.tags.includes("gluten")) return false;
    if (a === "lactose" && food.tags.includes("lactose")) return false;
    if (a === "nuts" && food.category === "nut-seed") return false;
    if (a === "eggs" && (food.slug === "egg-pasture" || food.slug === "egg-yolk")) return false;
    if (a === "soy" && (food.slug === "tofu" || food.slug === "tempeh" || food.slug === "edamame" || food.slug === "natto" || food.slug === "miso")) return false;
    if (a === "shellfish" && (food.slug === "shrimp" || food.slug === "oysters" || food.slug === "mussels")) return false;
    if (a === "fish" && food.category === "fish") return false;
  }

  // Aversions: free-text — simple substring match against food label
  const av = (prefs.aversions ?? "").trim().toLowerCase();
  if (av) {
    const aversionTokens = av.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
    for (const token of aversionTokens) {
      if (token.length < 3) continue;
      if (food.label.toLowerCase().includes(token)) return false;
    }
  }

  return true;
}

/** Pick best diet pattern based on rule hits + prefs. */
function pickPattern(rules: RuleHit[], prefs: NutritionPref): EngineOutput["suggestedPattern"] {
  // 1) User pref dominates if explicit
  if (prefs.dietType === "vegan" || prefs.dietType === "vegetarian") {
    const p = PATTERN_BY_KEY["plant-based-balanced"];
    return { key: p.key, label: p.label, description: p.description, reason: `Régime ${prefs.dietType} explicite — ${p.label} est le pattern recommandé.` };
  }
  if (prefs.dietType === "pescatarian") {
    const p = PATTERN_BY_KEY["pescatarian"];
    return { key: p.key, label: p.label, description: p.description, reason: "Régime pescatarien — couvre oméga-3 et B12 sans viande terrestre." };
  }
  if (prefs.dietType === "keto") {
    const p = PATTERN_BY_KEY["ketogenic"];
    return { key: p.key, label: p.label, description: p.description, reason: "Régime cétogène explicite." };
  }
  if (prefs.dietType === "carnivore") {
    const p = PATTERN_BY_KEY["carnivore"];
    return { key: p.key, label: p.label, description: p.description, reason: "Régime carnivore explicite." };
  }

  // 2) Score patterns from rules
  const scores = new Map<string, number>();
  const bumpers: Record<string, string[]> = {
    "mediterranean-low-carb": ["Glycémie", "Métabolique"],
    "mind": ["Cardio + Cognition", "Méthylation"],
    "anti-inflammatory": ["Anti-inflammatoire"],
    "dash": ["Reins"],
    "low-fodmap": [], // gut-symptoms manuel
  };
  for (const r of rules) {
    for (const [pattern, benefits] of Object.entries(bumpers)) {
      if (benefits.includes(r.benefit)) {
        scores.set(pattern, (scores.get(pattern) ?? 0) + PRIORITY_WEIGHT[r.priority]);
      }
    }
  }
  // Always add méditerranéen as baseline
  scores.set("mediterranean", (scores.get("mediterranean") ?? 0) + 5);

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mediterranean";
  const p = PATTERN_BY_KEY[best];
  const triggers = rules
    .filter((r) => bumpers[best]?.includes(r.benefit))
    .slice(0, 3)
    .map((r) => r.subjectLabel);
  const reason = triggers.length
    ? `Choisi sur la base de : ${triggers.join(", ")}.`
    : "Pattern par défaut le mieux étudié pour la longévité globale.";
  return { key: p.key, label: p.label, description: p.description, reason };
}

export function runEngine(input: EngineInput): EngineOutput {
  const biomarkerHits = applyBiomarkerRules(input.biomarkers);
  const dnaHits = applyDnaRules(input.dna);
  const allHits = [...biomarkerHits, ...dnaHits];

  // Filter food slugs in each hit by prefs
  const filteredHits: RuleHit[] = allHits.map((h) => ({
    ...h,
    foodSlugs: h.foodSlugs.filter((s) => isFoodAllowed(s, input.prefs)),
  })).filter((h) => h.foodSlugs.length > 0);

  // Aggregate favored / avoid food scores
  const favorMap = new Map<string, { score: number; benefits: Set<string> }>();
  const avoidMap = new Map<string, { score: number; benefits: Set<string> }>();

  for (const h of filteredHits) {
    const target = h.action === "favor" ? favorMap : avoidMap;
    for (const slug of h.foodSlugs) {
      const cur = target.get(slug) ?? { score: 0, benefits: new Set<string>() };
      cur.score += PRIORITY_WEIGHT[h.priority];
      cur.benefits.add(h.benefit);
      target.set(slug, cur);
    }
  }

  const toSorted = (m: Map<string, { score: number; benefits: Set<string> }>) =>
    [...m.entries()]
      .map(([slug, v]) => ({ slug, score: v.score, benefits: [...v.benefits] }))
      .sort((a, b) => b.score - a.score);

  return {
    rules: filteredHits,
    favoredFoods: toSorted(favorMap),
    avoidFoods: toSorted(avoidMap),
    suggestedPattern: pickPattern(filteredHits, input.prefs),
  };
}

// Helper exposed for the API to compute hash inputs deterministically
export function inputFingerprint(input: EngineInput): string {
  const bm = input.biomarkers
    .map((b) => `${b.slug}:${b.value}:${b.date}`)
    .sort()
    .join("|");
  const dna = input.dna
    .map((d) => `${d.rsid}:${normalizeGenotype(d.userGenotype ?? "")}`)
    .sort()
    .join("|");
  const prefs = JSON.stringify({
    d: input.prefs.dietType,
    a: [...(input.prefs.allergies ?? [])].sort(),
    av: input.prefs.aversions,
    b: input.prefs.budget,
    c: [...(input.prefs.cuisines ?? [])].sort(),
  });
  return `bm=${bm};dna=${dna};prefs=${prefs}`;
}

export { DIET_PATTERNS };

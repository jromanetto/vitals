export type FoodCategory =
  | "protein-animal"
  | "protein-plant"
  | "fish"
  | "vegetable"
  | "leafy-green"
  | "fruit"
  | "berry"
  | "grain"
  | "legume"
  | "nut-seed"
  | "fat-oil"
  | "dairy"
  | "fermented"
  | "herb-spice"
  | "drink"
  | "sweetener"
  | "ultra-processed";

export type FoodTag =
  | "iron-heme"
  | "iron-nonheme"
  | "anti-inflammatory"
  | "methylation-support"
  | "antioxidant"
  | "omega-3"
  | "polyphenol"
  | "fiber-high"
  | "low-glycemic"
  | "high-glycemic"
  | "saturated-fat"
  | "trans-fat"
  | "low-fodmap"
  | "high-fodmap"
  | "gluten"
  | "lactose"
  | "histamine-high"
  | "vitamin-d"
  | "vitamin-k2"
  | "vitamin-b12"
  | "folate"
  | "magnesium"
  | "zinc"
  | "selenium"
  | "iodine"
  | "potassium"
  | "calcium"
  | "choline"
  | "sulforaphane"
  | "alcohol"
  | "caffeine"
  | "fructose-high"
  | "purine-high"
  | "salicylate"
  | "fermented";

export type Food = {
  slug: string;
  label: string;
  emoji: string;
  category: FoodCategory;
  tags: FoodTag[];
  /** True for foods that are excluded by certain diet types */
  excludedFor?: Array<"vegan" | "vegetarian" | "pescatarian" | "keto" | "carnivore">;
};

export type DietPattern = {
  key: string;
  label: string;
  description: string;
  macros: { protein: string; carbs: string; fat: string };
  /** Conditions sous lesquelles ce pattern est recommandé (matched by rules-engine) */
  triggers: string[];
};

export type RuleSource = "biomarker" | "dna";

export type FoodAction = "favor" | "avoid";

export type RuleHit = {
  source: RuleSource;
  ruleKey: string;
  /** Subject of the rule — biomarker slug or rsid */
  subject: string;
  /** Human label for UI */
  subjectLabel: string;
  reason: string;
  /** Bénéfice / catégorie pour grouper l'UI */
  benefit: string;
  priority: "high" | "moderate" | "info";
  /** Foods to recommend (favor) or avoid */
  action: FoodAction;
  foodSlugs: string[];
  /** Used by /nutrition Sources tab to deeplink */
  href?: string;
};

export type NutritionPref = {
  dietType: "omnivore" | "pescatarian" | "vegetarian" | "vegan" | "keto" | "carnivore";
  allergies: string[];
  aversions: string;
  budget: "low" | "medium" | "premium";
  cuisines: string[];
};

export type NutritionPlan = {
  dietPattern: { key: string; label: string; description: string };
  macros: { protein: string; carbs: string; fat: string };
  rationale: string; // markdown
  mealIdeas: { breakfast: string[]; lunch: string[]; dinner: string[]; snacks: string[] };
  favoredFoodsSorted: string[]; // food slugs
  avoidFoodsSorted: string[]; // food slugs
  rules: RuleHit[];
  generatedAt: number;
  cached: boolean;
};

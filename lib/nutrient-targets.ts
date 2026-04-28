// Daily target ranges per nutrient. All amounts are in the canonical unit listed.
// Ranges: low = below this is insufficient, optimal = [min, max], high = above is excessive.
// Sources: EFSA NRV, NIH ODS, longevity-functional-medicine consensus (Attia/Hyman/Rhonda Patrick).

export type NutrientTarget = {
  key: string;
  label: string;
  unit: "mg" | "mcg" | "g" | "IU";
  low: number;
  optimal: [number, number];
  high: number;
  notes?: string;
  primarySource: "food" | "supplement" | "both";
  /** Estimated typical daily intake from a Western adult diet (varied/healthy), in canonical unit. */
  dietaryDefault: number;
  /** True if the supplement is considered universally recommended (D3, B12 over 50, omega-3 if no fish, etc.) */
  essential?: boolean;
};

export const NUTRIENT_TARGETS: NutrientTarget[] = [
  // Vitamins
  { key: "vitamin-d", label: "Vitamine D3", unit: "IU", low: 1000, optimal: [2000, 5000], high: 10000, notes: "Cible 25(OH)D 40-80 ng/mL", primarySource: "supplement", dietaryDefault: 200, essential: true },
  { key: "vitamin-k2", label: "Vitamine K2", unit: "mcg", low: 45, optimal: [100, 200], high: 500, notes: "MK-7 idéale", primarySource: "supplement", dietaryDefault: 50 },
  { key: "vitamin-c", label: "Vitamine C", unit: "mg", low: 75, optimal: [200, 1000], high: 2000, primarySource: "food", dietaryDefault: 90 },
  { key: "vitamin-a", label: "Vitamine A (rétinol)", unit: "IU", low: 2000, optimal: [3000, 10000], high: 25000, primarySource: "food", dietaryDefault: 3000 },
  { key: "vitamin-e", label: "Vitamine E", unit: "IU", low: 30, optimal: [100, 400], high: 1000, primarySource: "food", dietaryDefault: 15 },
  { key: "b1", label: "Vitamine B1", unit: "mg", low: 1.1, optimal: [25, 100], high: 200, primarySource: "food", dietaryDefault: 1.5 },
  { key: "b2", label: "Vitamine B2", unit: "mg", low: 1.3, optimal: [10, 50], high: 200, primarySource: "food", dietaryDefault: 2.0 },
  { key: "b3", label: "Vitamine B3 / Niacine", unit: "mg", low: 14, optimal: [20, 100], high: 500, primarySource: "food", dietaryDefault: 20 },
  { key: "b5", label: "Vitamine B5", unit: "mg", low: 5, optimal: [10, 50], high: 1000, primarySource: "food", dietaryDefault: 5 },
  { key: "b6", label: "Vitamine B6 (P5P)", unit: "mg", low: 1.4, optimal: [10, 50], high: 100, primarySource: "food", dietaryDefault: 2.0 },
  { key: "b9", label: "Folate B9 (méthylfolate)", unit: "mcg", low: 200, optimal: [400, 800], high: 1000, primarySource: "both", dietaryDefault: 350 },
  { key: "b12", label: "Vitamine B12", unit: "mcg", low: 4, optimal: [100, 1000], high: 5000, notes: "Méthylcobalamine ≫ cyanocobalamine", primarySource: "supplement", dietaryDefault: 5, essential: true },
  { key: "biotin", label: "Biotine", unit: "mcg", low: 30, optimal: [50, 300], high: 5000, primarySource: "food", dietaryDefault: 35 },

  // Minerals
  { key: "magnesium", label: "Magnésium", unit: "mg", low: 200, optimal: [300, 500], high: 800, notes: "Glycinate / glycérophosphate", primarySource: "both", dietaryDefault: 280, essential: true },
  { key: "zinc", label: "Zinc", unit: "mg", low: 8, optimal: [15, 30], high: 50, primarySource: "both", dietaryDefault: 10 },
  { key: "selenium", label: "Sélénium", unit: "mcg", low: 55, optimal: [100, 200], high: 400, primarySource: "both", dietaryDefault: 90 },
  { key: "iodine", label: "Iode", unit: "mcg", low: 100, optimal: [150, 300], high: 1100, primarySource: "food", dietaryDefault: 180 },
  { key: "iron", label: "Fer", unit: "mg", low: 8, optimal: [10, 18], high: 45, notes: "Bisglycinate, à jeun + vit C", primarySource: "food", dietaryDefault: 12 },
  { key: "copper", label: "Cuivre", unit: "mg", low: 0.7, optimal: [1, 2], high: 5, primarySource: "food", dietaryDefault: 1.2 },
  { key: "manganese", label: "Manganèse", unit: "mg", low: 1.5, optimal: [2, 5], high: 11, primarySource: "food", dietaryDefault: 2.5 },
  { key: "chromium", label: "Chrome", unit: "mcg", low: 25, optimal: [50, 200], high: 1000, primarySource: "food", dietaryDefault: 35 },
  { key: "boron", label: "Bore", unit: "mg", low: 0.5, optimal: [1, 3], high: 20, primarySource: "food", dietaryDefault: 1.2 },
  { key: "molybdenum", label: "Molybdène", unit: "mcg", low: 45, optimal: [50, 150], high: 2000, primarySource: "food", dietaryDefault: 90 },
  { key: "potassium", label: "Potassium", unit: "mg", low: 2000, optimal: [3500, 4700], high: 7000, primarySource: "food", dietaryDefault: 2800 },
  { key: "calcium", label: "Calcium", unit: "mg", low: 800, optimal: [1000, 1200], high: 2500, primarySource: "food", dietaryDefault: 900 },

  // Lipids / specific compounds
  { key: "omega-3", label: "Oméga-3 (EPA+DHA)", unit: "mg", low: 500, optimal: [1000, 3000], high: 5000, primarySource: "supplement", dietaryDefault: 250, essential: true },
  { key: "coq10", label: "CoQ10", unit: "mg", low: 30, optimal: [100, 300], high: 600, primarySource: "supplement", dietaryDefault: 5 },
  { key: "choline", label: "Choline", unit: "mg", low: 425, optimal: [500, 800], high: 3500, primarySource: "food", dietaryDefault: 350 },
  { key: "betaine", label: "Bétaïne (TMG)", unit: "mg", low: 500, optimal: [1000, 3000], high: 6000, primarySource: "food", dietaryDefault: 200 },

  // Amino acids
  { key: "creatine", label: "Créatine monohydrate", unit: "g", low: 3, optimal: [3, 5], high: 10, primarySource: "supplement", dietaryDefault: 1 },
  { key: "taurine", label: "Taurine", unit: "g", low: 0.5, optimal: [1, 3], high: 6, primarySource: "food", dietaryDefault: 200 },
  { key: "glycine", label: "Glycine", unit: "g", low: 1, optimal: [3, 5], high: 15, primarySource: "both", dietaryDefault: 3 },
  { key: "theanine", label: "L-théanine", unit: "mg", low: 100, optimal: [200, 400], high: 1200, primarySource: "supplement", dietaryDefault: 100 },
  { key: "tyrosine", label: "L-tyrosine", unit: "mg", low: 250, optimal: [500, 2000], high: 5000, primarySource: "food", dietaryDefault: 1000 },
  { key: "carnitine", label: "L-carnitine", unit: "mg", low: 250, optimal: [500, 2000], high: 4000, primarySource: "food", dietaryDefault: 150 },

  // Antioxidants & herbs
  { key: "nac", label: "NAC", unit: "mg", low: 200, optimal: [600, 1800], high: 2400, primarySource: "supplement", dietaryDefault: 0 },
  { key: "glutathione", label: "Glutathion", unit: "mg", low: 100, optimal: [250, 500], high: 1000, primarySource: "supplement", dietaryDefault: 0 },
  { key: "berberine", label: "Berbérine", unit: "mg", low: 500, optimal: [1000, 1500], high: 1500, primarySource: "supplement", dietaryDefault: 0 },
  { key: "curcumin", label: "Curcumine", unit: "mg", low: 250, optimal: [500, 1000], high: 2000, notes: "Forme liposomale (Meriva) ≫ poudre", primarySource: "supplement", dietaryDefault: 50 },
  { key: "ashwagandha", label: "Ashwagandha", unit: "mg", low: 300, optimal: [300, 600], high: 1200, primarySource: "supplement", dietaryDefault: 0 },
  { key: "rhodiola", label: "Rhodiola", unit: "mg", low: 100, optimal: [200, 600], high: 1000, primarySource: "supplement", dietaryDefault: 0 },
  { key: "resveratrol", label: "Resvératrol", unit: "mg", low: 100, optimal: [250, 500], high: 1500, primarySource: "food", dietaryDefault: 1 },
  { key: "quercetin", label: "Quercétine", unit: "mg", low: 250, optimal: [500, 1000], high: 2000, primarySource: "food", dietaryDefault: 15 },
  { key: "sulforaphane", label: "Sulforaphane", unit: "mg", low: 10, optimal: [20, 40], high: 100, primarySource: "food", dietaryDefault: 8 },

  // Skin / vision
  { key: "hyaluronic", label: "Acide hyaluronique", unit: "mg", low: 50, optimal: [100, 200], high: 500, primarySource: "supplement", dietaryDefault: 0 },
  { key: "lutein", label: "Lutéine", unit: "mg", low: 5, optimal: [10, 20], high: 40, primarySource: "food", dietaryDefault: 2 },
  { key: "lycopene", label: "Lycopène", unit: "mg", low: 5, optimal: [10, 30], high: 75, primarySource: "food", dietaryDefault: 10 },
  { key: "astaxanthin", label: "Astaxanthine", unit: "mg", low: 2, optimal: [4, 12], high: 24, primarySource: "supplement", dietaryDefault: 0 },

  // Others
  { key: "melatonin", label: "Mélatonine", unit: "mg", low: 0.3, optimal: [0.5, 3], high: 10, primarySource: "supplement", dietaryDefault: 0 },
  { key: "tudca", label: "TUDCA", unit: "mg", low: 250, optimal: [500, 1000], high: 1750, primarySource: "supplement", dietaryDefault: 0 },
  { key: "pqq", label: "PQQ", unit: "mg", low: 10, optimal: [20, 40], high: 80, primarySource: "supplement", dietaryDefault: 0 },
];

export const TARGETS_BY_KEY: Record<string, NutrientTarget> = Object.fromEntries(NUTRIENT_TARGETS.map((t) => [t.key, t]));

// Convert (value, unit) to the canonical unit of the nutrient. Returns null if incompatible.
export function convertTo(value: number, fromUnit: string, toUnit: NutrientTarget["unit"], nutrientKey?: string): number | null {
  const f = (fromUnit || "").toLowerCase().trim().replace(/[μµ]/g, "u");
  const fNorm = f.replace(/^ug$/, "mcg");
  const t = toUnit.toLowerCase();

  // IU conversions (only D3 and E supported reliably)
  if (t === "iu") {
    if (fNorm === "iu") return value;
    if (nutrientKey === "vitamin-d" && (fNorm === "mcg")) return value * 40;
    if (nutrientKey === "vitamin-d" && (fNorm === "mg")) return value * 40 * 1000;
    if (nutrientKey === "vitamin-a" && (fNorm === "mcg")) return value * 3.33;
    if (nutrientKey === "vitamin-e" && (fNorm === "mg")) return value * 1.49;
    return null;
  }
  if (fNorm === "iu") {
    if (nutrientKey === "vitamin-d" && t === "mcg") return value / 40;
    if (nutrientKey === "vitamin-a" && t === "mcg") return value / 3.33;
    return null;
  }

  // mg-base conversion table
  const toMg: Record<string, number> = { mcg: 0.001, mg: 1, g: 1000 };
  if (fNorm in toMg && t in toMg) return (value * toMg[fNorm]) / toMg[t];
  return null;
}

export type CoverageStatus = "low" | "optimal" | "above-optimal" | "high";

export function statusOf(target: NutrientTarget, amount: number): CoverageStatus {
  if (amount < target.low) return "low";
  if (amount <= target.optimal[1]) return "optimal";
  if (amount < target.high) return "above-optimal";
  return "high";
}

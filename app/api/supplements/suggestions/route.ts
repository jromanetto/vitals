import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { buildActiveIndex, findCoverage } from "@/lib/supplement-nutrients";

export const runtime = "nodejs";

type Suggestion = {
  source: "biomarker" | "dna";
  supplement: string;
  reason: string;
  biomarker?: string; biomarkerSlug?: string; value?: number; unit?: string;
  rsid?: string; trait?: string; genotype?: string;
  dose: string; timing: string;
  priority: "high" | "moderate" | "info";
  coveredBy?: { id: number; name: string; nutrient: string } | null;
};

// === Biomarker-driven suggestions ===
const BIOMARKER_RULES: Record<string, Omit<Suggestion, "source" | "biomarker" | "biomarkerSlug" | "value" | "unit"> & { trigger: (latest: { value: number; refLow: number | null; refHigh: number | null; opt?: { lo: number | null; hi: number | null } }) => boolean }> = {
  "vitamine-d-25-oh": {
    supplement: "Vitamine D3 + K2",
    reason: "Vitamine D 25-OH sub-optimale (cible 40-80 ng/mL)",
    dose: "4000 UI D3 + 100 μg K2 MK7", timing: "matin avec le repas (gras)",
    priority: "high",
    trigger: (l) => l.value < (l.opt?.lo ?? 40),
  },
  "vitamine-b12": {
    supplement: "Méthylcobalamine B12",
    reason: "B12 sub-optimale (cible >500 pg/mL)",
    dose: "1000 μg sublingual", timing: "matin à jeun",
    priority: "high",
    trigger: (l) => l.value < 500,
  },
  "ferritine": {
    supplement: "Bisglycinate de fer",
    reason: "Ferritine basse (cible 70-120 ng/mL)",
    dose: "25-50 mg", timing: "à jeun avec vitamine C",
    priority: "high",
    trigger: (l) => l.value < 70,
  },
  "magnesium-erythrocytaire": {
    supplement: "Magnésium bisglycinate",
    reason: "Magnésium intra-cellulaire bas",
    dose: "300-400 mg", timing: "soir avant coucher",
    priority: "moderate",
    trigger: (l) => l.value < (l.opt?.lo ?? 1.8),
  },
  "magnesium-serique": {
    supplement: "Magnésium bisglycinate",
    reason: "Magnésium sérique sous l'optimum",
    dose: "300-400 mg", timing: "soir",
    priority: "moderate",
    trigger: (l) => l.value < (l.opt?.lo ?? 2.0),
  },
  "homocysteine": {
    supplement: "Méthylfolate + B12 + B6 (cofacteurs méthylation)",
    reason: "Homocystéine élevée — méthylation sub-optimale",
    dose: "L-MTHF 800 μg + B12 500 μg + B6 25 mg", timing: "matin",
    priority: "high",
    trigger: (l) => l.value > 9,
  },
  "ldl": {
    supplement: "Berbérine + Bergamote (Citrus bergamia)",
    reason: "LDL au-dessus de la cible longévité (<70 mg/dL)",
    dose: "Berbérine 500mg x2 + Bergamote 500mg", timing: "midi et soir avec repas",
    priority: "moderate",
    trigger: (l) => l.value > 70,
  },
  "crp-ultrasensible-hscrp": {
    supplement: "EPA/DHA haute concentration + Curcumine",
    reason: "Inflammation de bas grade (hsCRP > 0.5 mg/L)",
    dose: "Oméga-3 2-3g (EPA+DHA) + Curcumine 500mg", timing: "midi avec repas",
    priority: "high",
    trigger: (l) => l.value > 0.5,
  },
  "selenium": {
    supplement: "Sélénométhionine",
    reason: "Sélénium bas (cofacteur thyroïde + antioxydant)",
    dose: "100-200 μg", timing: "matin",
    priority: "moderate",
    trigger: (l) => l.value < (l.opt?.lo ?? 100),
  },
  "zinc-serique": {
    supplement: "Zinc bisglycinate",
    reason: "Zinc bas (testostérone, immunité, peau)",
    dose: "15-25 mg", timing: "soir, sans cuivre",
    priority: "moderate",
    trigger: (l) => l.value < (l.opt?.lo ?? 90),
  },
  "tsh": {
    supplement: "Iode + sélénium + L-tyrosine",
    reason: "TSH au-dessus de l'optimum fonctionnel (>2.5)",
    dose: "Iode 150 μg + Sélénium 100 μg + Tyrosine 500mg", timing: "matin à jeun",
    priority: "moderate",
    trigger: (l) => l.value > 2.5,
  },
  "testosterone-totale": {
    supplement: "Tongkat Ali + Zinc + DHEA (avec avis médecin)",
    reason: "Testostérone totale sous l'optimum (>5.5 ng/mL)",
    dose: "Tongkat 400mg + Zinc 25mg", timing: "matin",
    priority: "info",
    trigger: (l) => l.value < 5.5,
  },
};

// === DNA-driven suggestions ===
type DnaRule = {
  rsid: string;
  riskGenotypes?: string[];
  alwaysSuggest?: boolean;
  supplement: string;
  reason: (genotype: string, trait: string) => string;
  dose: string;
  timing: string;
  priority: "high" | "moderate" | "info";
};

const DNA_RULES: DnaRule[] = [
  // Caffeine slow metabolizer
  { rsid: "rs762551", riskGenotypes: ["CC", "AC"],
    supplement: "Réduction caféine (≤200mg/j)",
    reason: (g) => `CYP1A2 ${g} = métaboliseur lent de la caféine. Risque cardio majoré si >2 cafés/jour.`,
    dose: "≤1-2 cafés/jour avant midi", timing: "matin uniquement", priority: "moderate" },

  // MTHFR — methylfolate over folic acid
  { rsid: "rs1801133", riskGenotypes: ["TT", "CT"],
    supplement: "Méthylfolate (5-MTHF) au lieu d'acide folique",
    reason: (g) => `MTHFR C677T ${g} = activité enzymatique réduite 30-70%. Préférer la forme active.`,
    dose: "L-MTHF 400-800 μg + B12 méthylcobalamine 500μg", timing: "matin", priority: "high" },
  { rsid: "rs1801131", riskGenotypes: ["GG"],
    supplement: "Méthylfolate + B6 P5P",
    reason: (g) => `MTHFR A1298C ${g} = activité réduite, à combiner avec C677T pour une vue complète.`,
    dose: "L-MTHF 400μg + B6 P5P 25mg", timing: "matin", priority: "moderate" },

  // FUT2 non-secretor → B12 absorption issues
  { rsid: "rs601338", riskGenotypes: ["AA"],
    supplement: "B12 sublinguale (méthylcobalamine)",
    reason: (g) => `FUT2 ${g} = non-sécréteur, absorption intestinale B12 réduite. Sublingual contourne.`,
    dose: "B12 1000-5000 μg", timing: "matin à jeun", priority: "high" },

  // VDR FokI → vitamin D resistance
  { rsid: "rs2228570", riskGenotypes: ["TT"],
    supplement: "Vitamine D3 dose plus haute + K2 + magnésium",
    reason: (g) => `VDR FokI ${g} = récepteur moins actif, viser 50-70 ng/mL plutôt que 30+.`,
    dose: "D3 5000-10000 UI + K2 MK7 100μg + Mg 300mg", timing: "matin avec gras", priority: "moderate" },
  { rsid: "rs2282679", riskGenotypes: ["CC"],
    supplement: "Vitamine D3 dose plus haute",
    reason: (g) => `GC ${g} = transporteur vitamine D moins efficace, taux 25(OH)D plus bas.`,
    dose: "D3 4000-6000 UI", timing: "matin avec gras", priority: "moderate" },

  // FADS1/FADS2 — poor omega-3 conversion
  { rsid: "rs174537", riskGenotypes: ["GG"],
    supplement: "EPA/DHA marin (huile de poisson ou algue)",
    reason: (g) => `FADS1 ${g} = conversion ALA→EPA/DHA réduite. Préférer EPA/DHA direct vs ALA végétal.`,
    dose: "EPA 1-2g + DHA 500mg-1g", timing: "midi avec repas", priority: "moderate" },

  // BCMO1 — poor β-carotene → retinol conversion
  { rsid: "rs7501331", riskGenotypes: ["TT", "CT"],
    supplement: "Vitamine A préformée (rétinol) plutôt que β-carotène",
    reason: (g) => `BCMO1 ${g} = conversion β-carotène→rétinol réduite 30-70%. Privilégier foie, jaune, fish liver oil.`,
    dose: "Foie 1x/sem ou cod liver oil 5mL", timing: "midi", priority: "info" },

  // PEMT — choline need
  { rsid: "rs7946", riskGenotypes: ["AA"],
    supplement: "Choline (alpha-GPC ou phosphatidylcholine)",
    reason: (g) => `PEMT ${g} = synthèse endogène choline réduite, besoin alimentaire accru.`,
    dose: "Alpha-GPC 300-600mg ou jaune d'œuf 2-3/jour", timing: "matin/midi", priority: "moderate" },

  // SLCO1B1 — statin myopathy
  { rsid: "rs4149056", riskGenotypes: ["CC", "CT"],
    supplement: "CoQ10 (si statine présente)",
    reason: (g) => `SLCO1B1 ${g} = sensibilité accrue aux statines → risque myopathie. CoQ10 supporte la mitochondrie.`,
    dose: "Ubiquinol 100-200mg", timing: "midi avec gras", priority: "high" },

  // SOD2 — antioxidant defense
  { rsid: "rs4880", riskGenotypes: ["TT"],
    supplement: "NAC + glutathion + vitamine E",
    reason: (g) => `SOD2 Val/Val (${g}) = mitochondrie moins protégée. Renforcer la défense antioxydante.`,
    dose: "NAC 600mg + Glutathion 250mg liposomal + Vit E 400 UI", timing: "matin", priority: "moderate" },

  // NQO1 — quinone detox
  { rsid: "rs1800566", riskGenotypes: ["TT"],
    supplement: "Sulforaphane (broccoli sprouts) + NAC",
    reason: (g) => `NQO1 ${g} = détoxication quinones réduite. Sulforaphane upregule Phase 2.`,
    dose: "Broccoli sprouts 30g/jour ou sulforaphane 30mg", timing: "matin", priority: "moderate" },

  // GSTP1 — glutathione transferase
  { rsid: "rs1695", riskGenotypes: ["GG"],
    supplement: "NAC + glycine",
    reason: (g) => `GSTP1 ${g} = phase 2 moins efficace. Booster les précurseurs glutathion.`,
    dose: "NAC 600-1200mg + Glycine 3-5g", timing: "matin et soir", priority: "moderate" },

  // HFE — hemochromatosis carriers
  { rsid: "rs1799945", riskGenotypes: ["GG", "CG"],
    supplement: "Surveillance ferritine + éviter supplémentation fer",
    reason: (g) => `HFE H63D ${g} = absorption fer accrue. Vérifier ferritine régulièrement, ne pas supplémenter en fer.`,
    dose: "—", timing: "—", priority: "high" },
  { rsid: "rs1800562", riskGenotypes: ["AA", "AG"],
    supplement: "Surveillance fer/ferritine/saturation transferrine — ne PAS supplémenter en fer",
    reason: (g) => `HFE C282Y ${g} = mutation hémochromatose. Bilan fer annuel + avis hépato.`,
    dose: "—", timing: "—", priority: "high" },

  // Factor V Leiden / Prothrombin
  { rsid: "rs6025", riskGenotypes: ["AA", "AG"],
    supplement: "Vigilance thrombose — éviter œstrogéniques, hydrater long courriers, bouger",
    reason: (g) => `Facteur V Leiden ${g} = risque thrombotique majoré. Précautions absolues si voyage long, contraception.`,
    dose: "—", timing: "—", priority: "high" },
  { rsid: "rs1799963", riskGenotypes: ["AA", "AG"],
    supplement: "Idem FVL — vigilance thrombose veineuse",
    reason: (g) => `Prothrombine G20210A ${g} = risque thrombose 2-3x. Cumulé avec FVL = majoré.`,
    dose: "—", timing: "—", priority: "high" },

  // BDNF Met — exercise + sleep critical for cognition
  { rsid: "rs6265", riskGenotypes: ["TT", "CT"],
    supplement: "Exercice aérobie régulier + sommeil prioritaire",
    reason: (g) => `BDNF Val66Met (${g}) = sécrétion BDNF réduite. L'exercice est le meilleur upregulator naturel.`,
    dose: "Cardio modéré 150 min/sem + sommeil 7-8h", timing: "matin/midi", priority: "moderate" },

  // ALDH2 (rare in Europe but high impact)
  { rsid: "rs671", riskGenotypes: ["AA", "AG"],
    supplement: "Éviter alcool — cancérogène majoré",
    reason: (g) => `ALDH2 ${g} = accumulation acétaldéhyde, risque cancer œsophage si consommation alcool.`,
    dose: "Abstinence alcool", timing: "—", priority: "high" },
];

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const out: Suggestion[] = [];

  // Active supplements index for coverage detection
  const activeRows = sqlite.prepare(`SELECT id, name, brand, ingredients, ended_at FROM supplement WHERE ended_at IS NULL`).all() as Array<{ id: number; name: string; brand: string | null; ingredients: string | null; ended_at: number | null }>;
  const activeIndex = buildActiveIndex(activeRows);

  // Biomarker-based
  const latestBms = sqlite.prepare(`
    SELECT b.slug, b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date
    FROM biomarker b
    JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date
  `).all() as Array<{ slug: string; name: string; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number }>;

  for (const r of latestBms) {
    const rec = BIOMARKER_RULES[r.slug];
    if (!rec) continue;
    const md = META_BY_SLUG[r.slug];
    if (rec.trigger({ value: r.value, refLow: r.refLow, refHigh: r.refHigh, opt: md ? { lo: md.optimalLow, hi: md.optimalHigh } : undefined })) {
      out.push({
        source: "biomarker", supplement: rec.supplement, reason: rec.reason,
        biomarker: r.name, biomarkerSlug: r.slug, value: r.value, unit: r.unit ?? undefined,
        dose: rec.dose, timing: rec.timing, priority: rec.priority,
        coveredBy: findCoverage(rec.supplement, activeIndex),
      });
    }
  }

  // DNA-based
  const dnaRows = sqlite.prepare(`SELECT rsid, trait, user_genotype FROM dna_insight WHERE user_genotype IS NOT NULL`).all() as Array<{ rsid: string; trait: string; user_genotype: string }>;
  const byRsid = Object.fromEntries(dnaRows.map((r) => [r.rsid, r]));

  for (const rule of DNA_RULES) {
    const found = byRsid[rule.rsid];
    if (!found) continue;
    const sortedG = found.user_genotype.split("").sort().join("");
    const isRisk = !rule.riskGenotypes || rule.riskGenotypes.some((g) => g.split("").sort().join("") === sortedG);
    if (!isRisk) continue;
    out.push({
      source: "dna", supplement: rule.supplement,
      reason: rule.reason(found.user_genotype, found.trait),
      rsid: rule.rsid, trait: found.trait, genotype: found.user_genotype,
      dose: rule.dose, timing: rule.timing, priority: rule.priority,
      coveredBy: rule.dose !== "—" ? findCoverage(rule.supplement, activeIndex) : null,
    });
  }

  // Sort: not-covered first, then by priority high → moderate → info
  const order = { high: 0, moderate: 1, info: 2 };
  out.sort((a, b) => {
    const ac = a.coveredBy ? 1 : 0;
    const bc = b.coveredBy ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return order[a.priority] - order[b.priority];
  });

  const coveredCount = out.filter((x) => x.coveredBy).length;
  return NextResponse.json({ suggestions: out, coveredCount, activeCount: activeIndex.length });
}

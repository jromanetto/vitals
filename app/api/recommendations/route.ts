import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { decryptProfile } from "@/lib/crypto-fields";
import { anonymizeProfile } from "@/lib/anonymize";

export const runtime = "nodejs";

type Recommendation = {
  slug: string;
  name: string;
  category: string;
  reason: string;
  priority: "high" | "moderate" | "info";
  triggers: { rsid?: string; trait?: string; ageGate?: number; whyMissing?: string }[];
};

// SNP → recommended biomarker(s) to monitor if has_risk
const SNP_TO_BIOMARKERS: Record<string, { biomarkers: string[]; reason: string }> = {
  "rs1799945": { biomarkers: ["ferritine", "fer-serique", "saturation-transferrine"], reason: "HFE H63D — surveiller surcharge fer" },
  "rs1800562": { biomarkers: ["ferritine", "fer-serique", "saturation-transferrine"], reason: "HFE C282Y — bilan fer obligatoire" },
  "rs6025": { biomarkers: ["d-dimeres", "homocysteine"], reason: "Facteur V Leiden — surveillance thrombotique" },
  "rs1799963": { biomarkers: ["d-dimeres", "homocysteine"], reason: "Prothrombine G20210A — surveillance thrombotique" },
  "rs1801133": { biomarkers: ["homocysteine", "vitamine-b12", "folates-b9", "folates-erythrocytaires"], reason: "MTHFR C677T — méthylation à monitorer" },
  "rs601338": { biomarkers: ["vitamine-b12", "holotranscobalamine-active-b12"], reason: "FUT2 non-sécréteur — B12 fonctionnelle" },
  "rs429358": { biomarkers: ["ldl", "apo-b", "lp-a", "hba1c"], reason: "APOE — surveillance cardio + cognitive accrue" },
  "rs7903146": { biomarkers: ["hba1c", "insuline", "homa-ir", "glycemie"], reason: "TCF7L2 — risque DT2 majoré" },
  "rs9939609": { biomarkers: ["insuline", "homa-ir", "leptine"], reason: "FTO — métabolisme à surveiller" },
  "rs10455872": { biomarkers: ["lp-a"], reason: "LPA — Lp(a) à mesurer une fois (génétiquement déterminé)" },
  "rs3798220": { biomarkers: ["lp-a"], reason: "LPA — Lp(a) à mesurer (variant majeur)" },
  "rs4149056": { biomarkers: ["alat-gpt", "asat-got", "ggt"], reason: "SLCO1B1 — surveillance hépatique sous statine" },
  "rs2228570": { biomarkers: ["vitamine-d-25-oh", "calcium-serique", "pth-parathormone"], reason: "VDR FokI — vit D et axe phospho-calcique" },
  "rs2282679": { biomarkers: ["vitamine-d-25-oh"], reason: "GC — vit D circulante plus basse" },
  "rs523349": { biomarkers: ["testosterone-totale", "testosterone-libre", "shbg"], reason: "SRD5A2 — DHT/androgenic activity" },
  "rs700518": { biomarkers: ["œstradiol", "testosterone-totale"], reason: "CYP19A1 — aromatase activity" },
  "rs225014": { biomarkers: ["t3-libre", "t4-libre", "tsh", "anti-tpo"], reason: "DIO2 — conversion T4→T3 périphérique" },
};

// Age-based recommendations (longevity panel >35)
const AGE_GATED_BIOMARKERS: Array<{ slug: string; name: string; minAge: number; reason: string }> = [
  { slug: "lp-a", name: "Lp(a)", minAge: 25, reason: "À mesurer une fois adulte (génétiquement déterminé)" },
  { slug: "apo-b", name: "Apo B", minAge: 30, reason: "Meilleur prédicteur cardio que LDL" },
  { slug: "homocysteine", name: "Homocystéine", minAge: 30, reason: "Marqueur méthylation et risque cardio" },
  { slug: "hba1c", name: "HbA1c", minAge: 25, reason: "Glycation moyenne 3 mois — détection pré-diabète" },
  { slug: "insuline", name: "Insuline à jeun", minAge: 30, reason: "Détection insulinorésistance précoce" },
  { slug: "homa-ir", name: "HOMA-IR", minAge: 30, reason: "Indice résistance insuline" },
  { slug: "vitamine-d-25-oh", name: "Vitamine D 25-OH", minAge: 18, reason: "Carence très commune, immunité + os" },
  { slug: "vitamine-b12", name: "Vitamine B12", minAge: 30, reason: "Cognition + énergie + méthylation" },
  { slug: "ferritine", name: "Ferritine", minAge: 18, reason: "Réserves fer + inflammation" },
  { slug: "tsh", name: "TSH", minAge: 25, reason: "Thyroïde — métabolisme et énergie" },
  { slug: "t3-libre", name: "T3 libre", minAge: 30, reason: "Forme active thyroïde — plus pertinent que TSH seul" },
  { slug: "crp-ultrasensible-hscrp", name: "hsCRP (CRP ultrasensible)", minAge: 30, reason: "Inflammation chronique de bas grade" },
  { slug: "testosterone-totale", name: "Testostérone totale", minAge: 30, reason: "Hormone clé chez l'homme adulte" },
  { slug: "shbg", name: "SHBG", minAge: 30, reason: "Pour calculer testostérone biodisponible" },
  { slug: "œstradiol", name: "Œstradiol", minAge: 30, reason: "Bilan hormonal complet (homme et femme)" },
  { slug: "dhea-s", name: "DHEA-S", minAge: 30, reason: "Précurseur stéroïdien, marqueur jeunesse hormonale" },
  { slug: "igf-1", name: "IGF-1", minAge: 30, reason: "GH/IGF axis — longévité (trade-off)" },
  { slug: "magnesium-erythrocytaire", name: "Magnésium érythrocytaire", minAge: 25, reason: "Carence très commune (90% pop), plus précis que sérique" },
  { slug: "selenium", name: "Sélénium", minAge: 25, reason: "Cofacteur thyroïde + antioxydant" },
  { slug: "zinc-serique", name: "Zinc", minAge: 25, reason: "Immunité, peau, testostérone" },
  { slug: "omega-3-index", name: "Index Oméga-3", minAge: 25, reason: "Risque cardio + inflammation" },
];

export async function GET() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const readViewUserId = viewUserId ?? authUserId;

  // Biomarkers + DNA insights now come from Convex (isolation resolved server-side
  // via active-link-only). Only the profile read stays on SQLite (no Convex fn yet).
  const [bio, dna] = await Promise.all([
    convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
    }),
    convexServer().query(api.dna.insights, {
      secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
    }),
  ]);

  // Legacy did SELECT DISTINCT slug — only presence matters, not latest value.
  const measured = new Set(bio.rows.map((r) => r.slug));
  const dnaRisks = dna.rows
    .filter((r) => !!r.hasRisk)
    .map((r) => ({ rsid: r.rsid, trait: r.trait, has_risk: 1 as const }));

  const { data } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
  });
  const profile = data ? anonymizeProfile(decryptProfile(JSON.parse(data))) : {};
  const age = profile.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate as string).getTime()) / (365.25 * 86400000)) : null;

  // Build map: slug → triggers + priority
  const recoMap: Record<string, Recommendation> = {};

  // DNA-driven
  for (const risk of dnaRisks) {
    const map = SNP_TO_BIOMARKERS[risk.rsid];
    if (!map) continue;
    for (const slug of map.biomarkers) {
      if (measured.has(slug)) continue;
      if (!recoMap[slug]) {
        recoMap[slug] = { slug, name: slug.replace(/-/g, " "), category: "dna-driven", reason: map.reason, priority: "high", triggers: [] };
      }
      recoMap[slug].triggers.push({ rsid: risk.rsid, trait: risk.trait });
      recoMap[slug].priority = "high";
    }
  }

  // Age-driven
  for (const bm of AGE_GATED_BIOMARKERS) {
    if (measured.has(bm.slug)) continue;
    if (age == null || age < bm.minAge) continue;
    const existing = recoMap[bm.slug];
    if (existing) {
      existing.triggers.push({ ageGate: bm.minAge, whyMissing: bm.reason });
    } else {
      recoMap[bm.slug] = {
        slug: bm.slug, name: bm.name, category: "age-based", reason: bm.reason,
        priority: "moderate", triggers: [{ ageGate: bm.minAge, whyMissing: bm.reason }],
      };
    }
  }

  const recommendations = Object.values(recoMap).sort((a, b) => {
    const order = { high: 0, moderate: 1, info: 2 };
    return order[a.priority] - order[b.priority];
  });

  return NextResponse.json({
    recommendations,
    age,
    measuredCount: measured.size,
  });
}

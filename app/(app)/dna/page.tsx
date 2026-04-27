import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import { dnaVariant } from "@/lib/db/schema";
import { DnaCategoryCard } from "@/components/dna-category-card";
import { DnaTopFindings } from "@/components/dna-top-findings";
import { DnaOverview } from "@/components/dna-overview";
import { DnaStrengths } from "@/components/dna-strengths";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { id: "cardiovascular", title: "Cardiovasculaire", desc: "Cholestérol, hypertension, risque thrombotique." },
  { id: "metabolism", title: "Métabolisme", desc: "Insulino-résistance, diabète T2, obésité, lipides." },
  { id: "longevity", title: "Longévité", desc: "FOXO3, APOE, télomères, méthylation, sirtuines." },
  { id: "nutrition", title: "Nutrition", desc: "Caféine, alcool, lactose, gluten, vitamine D, B12, folate." },
  { id: "fitness", title: "Performance", desc: "ACTN3 fast/slow twitch, VO2max, récupération, blessures." },
  { id: "cognitive", title: "Cognition", desc: "BDNF, COMT, dopamine, sommeil, anxiété, addiction." },
  { id: "hormones", title: "Hormones", desc: "Testostérone, œstrogènes, thyroïde, androgénétique." },
  { id: "immunity", title: "Immunité", desc: "HLA, auto-immunité, allergies, inflammation." },
  { id: "detox", title: "Détoxification", desc: "Phase I/II, CYP450, GST, sulfate, méthylation." },
  { id: "carriers", title: "Porteur", desc: "Mutations récessives transmissibles." },
];

async function counts() {
  ensureSchema();
  const d = db();
  const [variants] = await d.select({ c: sql<number>`count(*)` }).from(dnaVariant);
  const rows = d.$client.prepare(`
    SELECT category,
           COUNT(*) as c,
           SUM(CASE WHEN has_risk = 1 THEN 1 ELSE 0 END) as risk,
           SUM(CASE WHEN is_protective = 1 THEN 1 ELSE 0 END) as protective
    FROM dna_insight
    GROUP BY category
  `).all() as Array<{ category: string; c: number; risk: number; protective: number }>;
  const byCat = Object.fromEntries(rows.map((r) => [r.category, { c: r.c, risk: r.risk, protective: r.protective }]));
  const totals = rows.reduce((acc, r) => ({ c: acc.c + r.c, risk: acc.risk + r.risk, protective: acc.protective + r.protective }), { c: 0, risk: 0, protective: 0 });

  const top = d.$client.prepare(`SELECT rsid, category, trait, user_genotype as genotype, magnitude, summary FROM dna_insight WHERE has_risk = 1 ORDER BY COALESCE(magnitude,0) DESC LIMIT 6`).all() as Array<{ rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string }>;
  const strengths = d.$client.prepare(`SELECT rsid, category, trait, user_genotype as genotype, COALESCE(magnitude,0) as magnitude, summary, is_protective as isProtective FROM dna_insight WHERE is_protective = 1 ORDER BY COALESCE(magnitude,0) DESC LIMIT 6`).all() as Array<{ rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string; isProtective: number }>;

  return {
    totalVariants: variants?.c ?? 0,
    byCat,
    top,
    strengths: strengths.map((s) => ({ ...s, isProtective: !!s.isProtective })),
    totalAnalyzed: totals.c,
    riskCount: totals.risk,
    protectiveCount: totals.protective,
  };
}

export default async function DnaPage() {
  const { totalVariants, byCat, top, strengths, totalAnalyzed, riskCount, protectiveCount } = await counts();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">DNA Analysis</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {totalVariants > 0
            ? `${totalVariants.toLocaleString()} SNPs analysés depuis ton 23andMe.`
            : "Aucun ADN ingéré. Lance l'ingestion DNA depuis Profile pour démarrer."}
        </p>
      </div>

      {totalAnalyzed > 0 && (
        <DnaOverview
          totalVariants={totalVariants}
          totalAnalyzed={totalAnalyzed}
          riskCount={riskCount}
          protectiveCount={protectiveCount}
        />
      )}

      {strengths.length > 0 && <DnaStrengths strengths={strengths} />}

      {top.length > 0 && <DnaTopFindings findings={top} />}

      <div>
        <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Par catégorie</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((c, i) => (
            <DnaCategoryCard key={c.id} cat={c} stats={byCat[c.id]} idx={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

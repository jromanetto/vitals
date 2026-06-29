import { redirect } from "next/navigation";
import { effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { DnaCategoryCard } from "@/components/dna-category-card";
import { DnaTopFindings } from "@/components/dna-top-findings";
import { DnaOverview } from "@/components/dna-overview";
import { DnaStrengths } from "@/components/dna-strengths";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Dna as DnaIcon, Layers } from "lucide-react";

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

async function counts(userId: number) {
  ensureSchema();
  const d = db();
  const variants = d.$client.prepare(`SELECT COUNT(*) as c FROM dna_variant WHERE user_id = ?`).get(userId) as { c: number } | undefined;
  const rows = d.$client.prepare(`
    SELECT category,
           COUNT(*) as c,
           SUM(CASE WHEN has_risk = 1 THEN 1 ELSE 0 END) as risk,
           SUM(CASE WHEN is_protective = 1 THEN 1 ELSE 0 END) as protective
    FROM dna_insight
    WHERE user_id = ?
    GROUP BY category
  `).all(userId) as Array<{ category: string; c: number; risk: number; protective: number }>;
  const byCat = Object.fromEntries(rows.map((r) => [r.category, { c: r.c, risk: r.risk, protective: r.protective }]));
  // Carrier traits aren't a personal risk — they're hetero recessive mutations
  // relevant only for reproduction. Excluding them from the global "% favorable"
  // avoids dragging the score down for variants the user can't act on.
  const isCarrier = (cat: string) => cat.toLowerCase() === "carrier" || cat.toLowerCase() === "carriers" || cat.toLowerCase() === "porteur";
  const totals = rows
    .filter((r) => !isCarrier(r.category))
    .reduce((acc, r) => ({ c: acc.c + r.c, risk: acc.risk + r.risk, protective: acc.protective + r.protective }), { c: 0, risk: 0, protective: 0 });
  const carrierCount = rows.filter((r) => isCarrier(r.category)).reduce((a, r) => a + r.c, 0);

  const top = d.$client.prepare(`SELECT rsid, category, trait, user_genotype as genotype, magnitude, summary FROM dna_insight WHERE has_risk = 1 AND user_id = ? AND LOWER(category) NOT IN ('carrier','carriers','porteur') ORDER BY COALESCE(magnitude,0) DESC LIMIT 6`).all(userId) as Array<{ rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string }>;
  const strengths = d.$client.prepare(`SELECT rsid, category, trait, user_genotype as genotype, COALESCE(magnitude,0) as magnitude, summary, is_protective as isProtective FROM dna_insight WHERE is_protective = 1 AND user_id = ? ORDER BY COALESCE(magnitude,0) DESC LIMIT 6`).all(userId) as Array<{ rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string; isProtective: number }>;

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
  const userId = await effectiveUserId();
  if (!userId) redirect("/login");
  const { totalVariants, byCat, top, strengths, totalAnalyzed, riskCount, protectiveCount } = await counts(userId);
  return (
    <div className="space-y-12">
      <PageHeader
        title="Analyse ADN"
        description={
          totalVariants > 0
            ? `${totalVariants.toLocaleString()} SNPs analysés depuis ton 23andMe — répartis par système corporel, avec tes forces et ce qui est bon à savoir.`
            : "Aucun ADN ingéré. Lance l'ingestion DNA depuis Profile pour démarrer."
        }
        icon={<DnaIcon className="h-5 w-5 text-emerald" />}
      />

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

      <section>
        <SectionHeader
          eyebrow="Catégories"
          title="Par système corporel"
          description="10 systèmes analysés avec leur part favorable et ce qui est bon à savoir."
          icon={<Layers className="h-4 w-4 text-emerald" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map((c, i) => (
            <DnaCategoryCard key={c.id} cat={c} stats={byCat[c.id]} idx={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

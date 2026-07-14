import { redirect } from "next/navigation";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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

const isCarrier = (cat: string) => cat.toLowerCase() === "carrier" || cat.toLowerCase() === "carriers" || cat.toLowerCase() === "porteur";

async function counts(authUserId: number, viewUserId: number) {
  // dna_variant (1.8M raw SNP rows) stays on SQLite — not migrated to Convex.
  ensureSchema();
  const d = db();
  const variants = d.$client.prepare(`SELECT COUNT(*) as c FROM dna_variant WHERE user_id = ?`).get(viewUserId) as { c: number } | undefined;

  // dna_insight (derived) reads from Convex, resolved through the household guard.
  const { rows: insights } = await convexServer().query(api.dna.insights, {
    secret: bridgeSecret(), authUserId, viewUserId,
  });

  // Group by category into { c, risk, protective }.
  const byCat: Record<string, { c: number; risk: number; protective: number }> = {};
  for (const r of insights) {
    const g = (byCat[r.category] ??= { c: 0, risk: 0, protective: 0 });
    g.c += 1;
    if (r.hasRisk === 1) g.risk += 1;
    if (r.isProtective === 1) g.protective += 1;
  }
  // Carrier traits aren't a personal risk — they're hetero recessive mutations
  // relevant only for reproduction. Excluding them from the global "% favorable"
  // avoids dragging the score down for variants the user can't act on.
  const totals = Object.entries(byCat)
    .filter(([cat]) => !isCarrier(cat))
    .reduce((acc, [, g]) => ({ c: acc.c + g.c, risk: acc.risk + g.risk, protective: acc.protective + g.protective }), { c: 0, risk: 0, protective: 0 });

  const top = insights
    .filter((r) => r.hasRisk === 1 && !isCarrier(r.category))
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))
    .slice(0, 6)
    .map((r) => ({ rsid: r.rsid, category: r.category, trait: r.trait, genotype: r.userGenotype ?? "", magnitude: r.magnitude ?? 0, summary: r.summary ?? "" }));

  const strengths = insights
    .filter((r) => r.isProtective === 1)
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))
    .slice(0, 6)
    .map((r) => ({ rsid: r.rsid, category: r.category, trait: r.trait, genotype: r.userGenotype ?? "", magnitude: r.magnitude ?? 0, summary: r.summary ?? "", isProtective: r.isProtective === 1 }));

  return {
    totalVariants: variants?.c ?? 0,
    byCat,
    top,
    strengths,
    totalAnalyzed: totals.c,
    riskCount: totals.risk,
    protectiveCount: totals.protective,
  };
}

export default async function DnaPage() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) redirect("/login");
  const { totalVariants, byCat, top, strengths, totalAnalyzed, riskCount, protectiveCount } = await counts(authUserId, viewUserId ?? authUserId);
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

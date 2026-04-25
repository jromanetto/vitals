import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import { dnaVariant } from "@/lib/db/schema";
import { DnaCategoryCard } from "@/components/dna-category-card";

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
  const rows = d.$client.prepare(`SELECT category, COUNT(*) as c, SUM(CASE WHEN has_risk = 1 THEN 1 ELSE 0 END) as risk FROM dna_insight GROUP BY category`).all() as Array<{ category: string; c: number; risk: number }>;
  const byCat = Object.fromEntries(rows.map((r) => [r.category, { c: r.c, risk: r.risk }]));
  return { totalVariants: variants?.c ?? 0, byCat };
}

export default async function DnaPage() {
  const { totalVariants, byCat } = await counts();
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((c, i) => (
          <DnaCategoryCard key={c.id} cat={c} stats={byCat[c.id]} idx={i} />
        ))}
      </div>
    </div>
  );
}

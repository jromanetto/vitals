import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import { dnaVariant } from "@/lib/db/schema";
import { motion } from "framer-motion";
import Link from "next/link";

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
  const byCat = Object.fromEntries(rows.map((r) => [r.category, r]));
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
        {CATEGORIES.map((c, i) => {
          const stats = byCat[c.id];
          return (
            <Link key={c.id} href={`/dna/${c.id}`} className="group">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="rounded-xl border border-border bg-card p-5 hover:border-emerald/40 transition relative overflow-hidden"
              >
                <div className="text-base font-medium tracking-tight group-hover:text-emerald transition">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{stats?.c ?? 0} traits</span>
                  {stats && stats.risk > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {stats.risk} à surveiller
                    </span>
                  )}
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/stat-card";
import { HomeHero } from "@/components/home-hero";
import { LongevityGauge } from "@/components/longevity-gauge";
import { computeLongevityScore } from "@/lib/scoring/longevity";
import { ScoreBreakdownCard } from "@/components/score-breakdown";

export const dynamic = "force-dynamic";

async function getStats() {
  ensureSchema();
  const d = db();
  const [bmUnique] = await d.select({ c: sql<number>`count(distinct slug)` }).from(schema.biomarker);
  const [bmTotal] = await d.select({ c: sql<number>`count(*)` }).from(schema.biomarker);
  const [docs] = await d.select({ c: sql<number>`count(*)` }).from(schema.document);
  const [variants] = await d.select({ c: sql<number>`count(*)` }).from(schema.dnaVariant);
  const [insights] = await d.select({ c: sql<number>`count(*)` }).from(schema.dnaInsight);
  const [latest] = await d.select({ d: schema.biomarker.date }).from(schema.biomarker).orderBy(sql`${schema.biomarker.date} desc`).limit(1);
  return {
    biomarkersUnique: bmUnique?.c ?? 0,
    biomarkersTotal: bmTotal?.c ?? 0,
    documents: docs?.c ?? 0,
    dnaVariants: variants?.c ?? 0,
    dnaInsights: insights?.c ?? 0,
    latestPanel: latest?.d ?? null,
  };
}

export default async function Home() {
  const stats = await getStats();
  const score = computeLongevityScore();
  const latestStr = stats.latestPanel
    ? new Date(stats.latestPanel).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="space-y-8">
      <HomeHero />

      {/* Longevity score card + stat row */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center">
          <LongevityGauge score={score.total} />
          <div className="mt-4 text-xs text-center text-muted-foreground max-w-[200px] leading-relaxed">
            {score.total >= 80 ? "Excellent — continue comme ça." :
             score.total >= 60 ? "Bon — quelques leviers à optimiser." :
             score.total >= 40 ? "Mitigé — plusieurs axes à travailler." :
             "À surveiller — voir le détail des axes."}
          </div>
        </div>
        <ScoreBreakdownCard breakdown={score} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Biomarqueurs" value={stats.biomarkersUnique.toLocaleString()} hint={`${stats.biomarkersTotal} mesures totales`} delay={0.05} accent />
        <StatCard label="Documents" value={stats.documents.toLocaleString()} hint="rapports indexés" delay={0.1} />
        <StatCard label="Variants ADN" value={stats.dnaVariants.toLocaleString()} hint={`${stats.dnaInsights} insights`} delay={0.15} />
        <StatCard label="Dernier bilan" value={latestStr} delay={0.2} />
      </div>
    </div>
  );
}

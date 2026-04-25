import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/stat-card";
import { HomeHero } from "@/components/home-hero";
import { RecentReports } from "@/components/recent-reports";

export const dynamic = "force-dynamic";

async function getStats() {
  ensureSchema();
  const d = db();
  const [bm] = await d.select({ c: sql<number>`count(*)` }).from(schema.biomarker);
  const [docs] = await d.select({ c: sql<number>`count(*)` }).from(schema.document);
  const [variants] = await d.select({ c: sql<number>`count(*)` }).from(schema.dnaVariant);
  const [insights] = await d.select({ c: sql<number>`count(*)` }).from(schema.dnaInsight);
  const [latest] = await d
    .select({ d: schema.biomarker.date })
    .from(schema.biomarker)
    .orderBy(sql`${schema.biomarker.date} desc`)
    .limit(1);
  return {
    biomarkers: bm?.c ?? 0,
    documents: docs?.c ?? 0,
    dnaVariants: variants?.c ?? 0,
    dnaInsights: insights?.c ?? 0,
    latestPanel: latest?.d ?? null,
  };
}

export default async function Home() {
  const stats = await getStats();
  const latestStr = stats.latestPanel
    ? new Date(stats.latestPanel).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="space-y-8">
      <HomeHero />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Biomarkers" value={stats.biomarkers.toLocaleString()} hint="mesures totales" delay={0.05} accent />
        <StatCard label="Documents" value={stats.documents.toLocaleString()} hint="rapports indexés" delay={0.1} />
        <StatCard label="Variants ADN" value={stats.dnaVariants.toLocaleString()} hint="SNPs analysés" delay={0.15} />
        <StatCard label="Dernier bilan" value={latestStr} delay={0.2} />
      </div>
      <RecentReports />
    </div>
  );
}

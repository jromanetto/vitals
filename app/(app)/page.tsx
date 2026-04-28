import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/stat-card";
import { HomeHero } from "@/components/home-hero";
import { LongevityGauge } from "@/components/longevity-gauge";
import { computeLongevityScore } from "@/lib/scoring/longevity";
import { ScoreBreakdownCard } from "@/components/score-breakdown";
import { HomeSparklines } from "@/components/home-sparklines";
import { WearableWidget } from "@/components/wearable-widget";
import { SleepStageWidget } from "@/components/sleep-stage-widget";
import { RecoveryWidget } from "@/components/recovery-widget";
import { StreaksWidget } from "@/components/streaks-widget";
import { SectionHeader } from "@/components/section-header";
import { Activity, Moon, BarChart3, Heart } from "lucide-react";

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
    <div className="space-y-10">
      <HomeHero />

      {/* Score longévité */}
      <section>
        <SectionHeader
          eyebrow="Vue d'ensemble"
          title="Score longévité"
          description="Synthèse de tes biomarqueurs, ADN, suppléments et wearables — exprimée sur 100."
          icon={<Heart className="h-4 w-4 text-emerald" />}
          cta={{ href: "/action-plan", label: "Plan d'action" }}
        />
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center min-w-[240px]">
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
      </section>

      {/* Biomarqueurs et tendances */}
      <section>
        <SectionHeader
          eyebrow="Tendances santé"
          title="Tes biomarqueurs récents"
          description="Évolution sur les derniers bilans avec mini-graphes."
          icon={<BarChart3 className="h-4 w-4 text-emerald" />}
          cta={{ href: "/biomarkers", label: "Voir tous les biomarqueurs" }}
        />
        <HomeSparklines />
      </section>

      {/* Wearables */}
      <section>
        <SectionHeader
          eyebrow="Wearables"
          title="Whoop / Oura — 30 derniers jours"
          description="HRV, fréquence cardiaque au repos, sommeil et récupération."
          icon={<Activity className="h-4 w-4 text-emerald" />}
          cta={{ href: "/import", label: "Import wearables" }}
        />
        <div className="space-y-4">
          <WearableWidget />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SleepStageWidget />
            <RecoveryWidget />
          </div>
        </div>
      </section>

      {/* Habitudes */}
      <section>
        <SectionHeader
          eyebrow="Habitudes"
          title="Streaks & adhérence"
          description="Tes routines suivies au quotidien."
          icon={<Moon className="h-4 w-4 text-emerald" />}
          cta={{ href: "/habits", label: "Toutes les habitudes" }}
        />
        <StreaksWidget />
      </section>

      {/* Données indexées */}
      <section>
        <SectionHeader
          eyebrow="Base de connaissances"
          title="Données indexées"
          description="Tout ce que Vitals connaît sur toi à ce jour."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Biomarqueurs" value={stats.biomarkersUnique.toLocaleString()} hint={`${stats.biomarkersTotal} mesures totales`} delay={0.05} accent />
          <StatCard label="Documents" value={stats.documents.toLocaleString()} hint="rapports indexés" delay={0.1} />
          <StatCard label="Variants ADN" value={stats.dnaVariants.toLocaleString()} hint={`${stats.dnaInsights} insights`} delay={0.15} />
          <StatCard label="Dernier bilan" value={latestStr} delay={0.2} />
        </div>
      </section>
    </div>
  );
}

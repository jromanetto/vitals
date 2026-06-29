import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { effectiveUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/stat-card";
import { HomeHero } from "@/components/home-hero";
import { HomeChatBar } from "@/components/home-chat-bar";
import { computeLongevityScore } from "@/lib/scoring/longevity";
import { HomeScoreCard } from "@/components/home-score-card";
import { HomeSparklines } from "@/components/home-sparklines";
import { WearableWidget } from "@/components/wearable-widget";
import { SleepStageWidget } from "@/components/sleep-stage-widget";
import { RecoveryWidget } from "@/components/recovery-widget";
import { StreaksWidget } from "@/components/streaks-widget";
import { RemindersWidget } from "@/components/reminders-widget";
import { SectionHeader } from "@/components/section-header";
import { Activity, Moon, BarChart3, Heart, Bell, Sun } from "lucide-react";
import { OnboardingModal } from "@/components/onboarding-modal";
import { computeEnvironment } from "@/lib/environment";
import { EnvironmentCard } from "@/components/environment-card";

export const dynamic = "force-dynamic";

async function getStats(userId: number) {
  ensureSchema();
  const d = db();
  const scope = sql`user_id = ${userId}`;
  const [bmUnique] = await d.select({ c: sql<number>`count(distinct slug)` }).from(schema.biomarker).where(scope);
  const [bmTotal] = await d.select({ c: sql<number>`count(*)` }).from(schema.biomarker).where(scope);
  const [docs] = await d.select({ c: sql<number>`count(*)` }).from(schema.document).where(scope);
  const [variants] = await d.select({ c: sql<number>`count(*)` }).from(schema.dnaVariant).where(scope);
  const [insights] = await d.select({ c: sql<number>`count(*)` }).from(schema.dnaInsight).where(scope);
  const [latest] = await d.select({ d: schema.biomarker.date }).from(schema.biomarker).where(scope).orderBy(sql`${schema.biomarker.date} desc`).limit(1);
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
  const userId = await effectiveUserId();
  if (!userId) redirect("/login");
  const stats = await getStats(userId);
  const score = computeLongevityScore(userId);
  const env = computeEnvironment(userId);
  const latestStr = stats.latestPanel
    ? new Date(stats.latestPanel).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="space-y-14 md:space-y-16">
      <HomeHero />
      <HomeChatBar />
      <OnboardingModal documents={stats.documents} />

      {/* Score longévité */}
      <section>
        <SectionHeader
          eyebrow="Vue d'ensemble"
          title="Score longévité"
          description="Synthèse de tes biomarqueurs, ADN, suppléments et wearables — exprimée sur 100."
          icon={<Heart className="h-4 w-4 text-emerald" />}
          cta={{ href: "/action-plan", label: "Plan d'action" }}
        />
        <HomeScoreCard breakdown={score} />
      </section>

      {/* Environnement — lieu de vie × gènes */}
      <section>
        <SectionHeader
          eyebrow="Lieu de vie"
          title="Ton environnement"
          description="Ton exposition au soleil et à la pollution, croisée avec tes gènes — pour des conseils adaptés à là où tu vis."
          icon={<Sun className="h-4 w-4 text-emerald" />}
        />
        <EnvironmentCard env={env} />
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
        <div className="space-y-6">
          <WearableWidget />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Rappels & échéances */}
      <section>
        <SectionHeader
          eyebrow="À ne pas oublier"
          title="Rappels & échéances"
          description="Tes prochaines prises de sang, cures et consultations."
          icon={<Bell className="h-4 w-4 text-emerald" />}
          cta={{ href: "/reminders", label: "Voir tous" }}
        />
        <RemindersWidget />
      </section>

      {/* Données indexées */}
      <section>
        <SectionHeader
          eyebrow="Base de connaissances"
          title="Données indexées"
          description="Tout ce que Vitals connaît sur toi à ce jour."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Biomarqueurs" value={stats.biomarkersUnique.toLocaleString()} hint={`${stats.biomarkersTotal} mesures totales`} delay={0.05} accent />
          <StatCard label="Documents" value={stats.documents.toLocaleString()} hint="rapports indexés" delay={0.1} />
          <StatCard label="Variants ADN" value={stats.dnaVariants.toLocaleString()} hint={`${stats.dnaInsights} insights`} delay={0.15} />
          <StatCard label="Dernier bilan" value={latestStr} delay={0.2} />
        </div>
      </section>
    </div>
  );
}

"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sun, Wind, MapPin, ArrowRight, Sparkles } from "lucide-react";
import type { Environment, EnvInsight } from "@/lib/environment";

const TONE: Record<EnvInsight["severity"], { ring: string; text: string; dot: string }> = {
  good: { ring: "border-emerald/30 bg-emerald/5", text: "text-emerald", dot: "bg-emerald" },
  info: { ring: "border-sky-500/25 bg-sky-500/5", text: "text-sky-400", dot: "bg-sky-400" },
  watch: { ring: "border-amber-500/25 bg-amber-500/5", text: "text-amber-400", dot: "bg-amber-400" },
};

function Panel({ icon, label, insight, delay }: { icon: React.ReactNode; label: string; insight: EnvInsight; delay: number }) {
  const t = TONE[insight.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }}
      className={`rounded-xl border ${t.ring} p-4`}
    >
      <div className="flex items-center gap-2">
        <span className={t.text}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium ${t.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{insight.title}
        </span>
      </div>
      <p className="mt-2.5 text-sm text-foreground/90 leading-relaxed">{insight.detail}</p>
      {insight.action && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          <span className={`font-medium ${t.text}`}>→ </span>{insight.action}
        </p>
      )}
    </motion.div>
  );
}

export function EnvironmentCard({ env }: { env: Environment }) {
  if (!env.location) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 flex flex-col items-center text-center gap-2">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm font-medium">Renseigne ta ville</div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Avec ton lieu de vie, Vitals croise ton exposition au soleil et à la pollution avec tes gènes pour des conseils sur-mesure.
        </p>
        <Link href="/profile" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-emerald hover:gap-2 transition-all">
          Compléter mon profil <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2 bg-gradient-to-br from-sky-500/5 via-card to-card">
        <MapPin className="h-4 w-4 text-emerald" />
        <span className="text-sm font-medium">{env.location.label}</span>
        <span className="text-[11px] text-muted-foreground">
          {env.location.resolved === "country" ? "· estimation pays" : `· ~${Math.round(env.location.lat)}° lat · PM2.5 ${env.location.pm25}`}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Sparkles className="h-3 w-3" /> gènes × environnement
        </span>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {env.sun && <Panel icon={<Sun className="h-4 w-4" />} label="Soleil & vitamine D" insight={env.sun.insight} delay={0.05} />}
        {env.pollution && <Panel icon={<Wind className="h-4 w-4" />} label="Air & pollution" insight={env.pollution.insight} delay={0.12} />}
      </div>
    </div>
  );
}

"use client";
import { motion } from "framer-motion";
import { Shield, Sparkles, AlertCircle, Dna as DnaIcon } from "lucide-react";

type Props = {
  totalVariants: number;
  totalAnalyzed: number;
  riskCount: number;
  protectiveCount: number;
};

export function DnaOverview({ totalVariants, totalAnalyzed, riskCount, protectiveCount }: Props) {
  const standardCount = Math.max(0, totalAnalyzed - riskCount - protectiveCount);
  const favorableCount = standardCount + protectiveCount;
  const favorablePct = totalAnalyzed > 0 ? Math.round((favorableCount / totalAnalyzed) * 100) : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr] divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-6 bg-gradient-to-br from-emerald/10 via-card to-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <DnaIcon className="h-3.5 w-3.5" /> Vue d'ensemble
          </div>
          <div className="mt-3">
            <div className="text-4xl font-semibold tabular-nums">{favorablePct}%</div>
            <div className="text-sm text-foreground mt-1">de tes gènes analysés sont dans la zone <span className="text-emerald font-medium">favorable</span></div>
            <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Sur {totalAnalyzed} variants analysés depuis tes {totalVariants.toLocaleString()} SNPs 23andMe, l'immense majorité ne porte pas de risque connu.
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-3 gap-3">
          <Card icon={<Shield className="h-4 w-4 text-emerald" />} value={protectiveCount} label="Protecteurs" sub="variants favorables identifiés" tone="emerald" />
          <Card icon={<Sparkles className="h-4 w-4 text-sky-400" />} value={standardCount} label="Standards" sub="génotype neutre, pas de risque" tone="sky" />
          <Card icon={<AlertCircle className="h-4 w-4 text-amber-400" />} value={riskCount} label="À surveiller" sub="variants à monitorer" tone="amber" />

          <div className="col-span-3 mt-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Répartition</div>
            <div className="h-2.5 w-full rounded-full overflow-hidden bg-secondary/40 flex">
              {protectiveCount > 0 && (
                <motion.div initial={{ width: 0 }} animate={{ width: `${(protectiveCount / totalAnalyzed) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 }}
                            className="h-full bg-emerald" title={`${protectiveCount} protecteurs`} />
              )}
              <motion.div initial={{ width: 0 }} animate={{ width: `${(standardCount / totalAnalyzed) * 100}%` }} transition={{ duration: 0.6, delay: 0.2 }}
                          className="h-full bg-sky-500/60" title={`${standardCount} standards`} />
              {riskCount > 0 && (
                <motion.div initial={{ width: 0 }} animate={{ width: `${(riskCount / totalAnalyzed) * 100}%` }} transition={{ duration: 0.6, delay: 0.3 }}
                            className="h-full bg-amber-500" title={`${riskCount} à surveiller`} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
              <span>{((favorableCount / totalAnalyzed) * 100).toFixed(0)}% favorable</span>
              <span>{((riskCount / totalAnalyzed) * 100).toFixed(0)}% à surveiller</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Card({ icon, value, label, sub, tone }: { icon: React.ReactNode; value: number; label: string; sub: string; tone: "emerald" | "sky" | "amber" }) {
  const ring = tone === "emerald" ? "border-emerald/30 bg-emerald/5" : tone === "sky" ? "border-sky-500/30 bg-sky-500/5" : "border-amber-500/30 bg-amber-500/5";
  const accent = tone === "emerald" ? "text-emerald" : tone === "sky" ? "text-sky-400" : "text-amber-400";
  return (
    <div className={`rounded-xl border ${ring} p-3`}>
      <div className="flex items-center gap-1.5">{icon}<span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span></div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sub}</div>
    </div>
  );
}

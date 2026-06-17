"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type Finding = { rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string };

// Magnitude → calm, non-alarming wording. We deliberately avoid "×N" multipliers
// (they read like a severity score) and red/triangle alarms.
function effectLabel(m: number): string {
  if (m >= 4) return "effet notable";
  if (m >= 2) return "effet modéré";
  return "effet léger";
}

export function DnaTopFindings({ findings }: { findings: Finding[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sky-400" />
        <h2 className="text-sm font-medium">Bon à savoir sur tes gènes ({findings.length})</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 mb-3 leading-relaxed max-w-2xl">
        Des tendances, pas une fatalité — un gène est une prédisposition, et ton mode de vie pèse souvent bien plus lourd. Voici les variantes qui valent un coup d&apos;œil.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {findings.map((f, i) => (
          <Link key={f.rsid + f.trait} href={`/dna/${f.category}`} className="group">
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-border bg-card p-4 hover:border-sky-500/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm group-hover:text-sky-400 transition">{f.trait}</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400/90 shrink-0 whitespace-nowrap">{effectLabel(f.magnitude)}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{f.category} · {f.genotype}</div>
              <div className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{f.summary}</div>
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.section>
  );
}

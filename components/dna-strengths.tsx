"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, ThumbsUp } from "lucide-react";

type Strength = { rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string; isProtective: boolean };

export function DnaStrengths({ strengths }: { strengths: Strength[] }) {
  if (strengths.length === 0) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-emerald/30 bg-emerald/5 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <ThumbsUp className="h-4 w-4 text-emerald" />
        <h2 className="text-sm font-medium">Tes points forts génétiques ({strengths.length})</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">Variants protecteurs ou favorables identifiés</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {strengths.map((f, i) => (
          <Link key={f.rsid + f.trait} href={`/dna/${f.category}`} className="group">
            <motion.div
              initial={{ opacity: 0, y: 4 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-xl border border-border bg-card p-4 hover:border-emerald/40 transition relative overflow-hidden"
            >
              <div className="absolute top-3 right-3"><Shield className="h-3.5 w-3.5 text-emerald/60" /></div>
              <div className="font-medium text-sm group-hover:text-emerald transition pr-6">{f.trait}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{f.category} · {f.rsid} · {f.genotype}</div>
              <div className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{f.summary}</div>
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.section>
  );
}

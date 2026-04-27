"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

type Finding = { rsid: string; category: string; trait: string; genotype: string; magnitude: number; summary: string };

export function DnaTopFindings({ findings }: { findings: Finding[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-medium">Points d'attention ({findings.length})</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {findings.map((f, i) => (
          <Link key={f.rsid + f.trait} href={`/dna/${f.category}`} className="group">
            <motion.div
              initial={{ opacity: 0, y: 4 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-xl border border-border bg-card p-4 hover:border-amber-500/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm group-hover:text-amber-400 transition">{f.trait}</div>
                <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">×{f.magnitude}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{f.category} · {f.rsid} · {f.genotype}</div>
              <div className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{f.summary}</div>
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.section>
  );
}

"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export type Cat = { id: string; title: string; desc: string };
export type Stat = { c: number; risk: number };

export function DnaCategoryCard({ cat, stats, idx }: { cat: Cat; stats?: Stat; idx: number }) {
  return (
    <Link href={`/dna/${cat.id}`} className="group">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: idx * 0.04 }}
        className="rounded-xl border border-border bg-card p-5 hover:border-emerald/40 transition relative overflow-hidden"
      >
        <div className="text-base font-medium tracking-tight group-hover:text-emerald transition">{cat.title}</div>
        <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{cat.desc}</div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{stats?.c ?? 0} traits</span>
          {stats && stats.risk > 0 && (
            <span title={`${stats.risk} traits à risque sur ${stats.c} dans cette catégorie`}
                  className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-help">
              {stats.risk} à surveiller
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

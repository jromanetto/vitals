"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, AlertCircle } from "lucide-react";

export type Cat = { id: string; title: string; desc: string };
export type Stat = { c: number; risk: number; protective: number };

export function DnaCategoryCard({ cat, stats, idx }: { cat: Cat; stats?: Stat; idx: number }) {
  const c = stats?.c ?? 0;
  const risk = stats?.risk ?? 0;
  const prot = stats?.protective ?? 0;
  const standard = Math.max(0, c - risk - prot);
  const favorable = standard + prot;
  const favorablePct = c > 0 ? Math.round((favorable / c) * 100) : 100;

  // Border tone reflects ratio
  const borderTone =
    c === 0 ? "border-border"
    : risk === 0 ? "border-emerald/30 hover:border-emerald/50"
    : risk / c < 0.25 ? "border-border hover:border-emerald/40"
    : "border-amber-500/20 hover:border-amber-500/40";

  return (
    <Link href={`/dna/${cat.id}`} className="group">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
        className={`rounded-xl border ${borderTone} bg-card p-5 transition relative overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-base font-medium tracking-tight group-hover:text-emerald transition">{cat.title}</div>
          {prot > 0 && <Shield className="h-3.5 w-3.5 text-emerald shrink-0 mt-0.5" />}
        </div>
        <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{cat.desc}</div>

        {c > 0 ? (
          <>
            <div className="mt-4 mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-emerald">{favorablePct}%</span>
              <span className="text-[11px] text-muted-foreground">favorable</span>
              <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{c} traits</span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden bg-secondary/40 flex">
              {prot > 0 && <div className="h-full bg-emerald" style={{ width: `${(prot / c) * 100}%` }} />}
              <div className="h-full bg-sky-500/60" style={{ width: `${(standard / c) * 100}%` }} />
              {risk > 0 && <div className="h-full bg-amber-500" style={{ width: `${(risk / c) * 100}%` }} />}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
              {prot > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald" />{prot} protecteur{prot > 1 ? "s" : ""}</span>}
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-500/60" />{standard} standard{standard > 1 ? "s" : ""}</span>
              {risk > 0 && <span className="flex items-center gap-1 text-amber-400/90"><AlertCircle className="h-2.5 w-2.5" />{risk}</span>}
            </div>
          </>
        ) : (
          <div className="mt-4 text-[10px] text-muted-foreground">Aucun trait analysé</div>
        )}
      </motion.div>
    </Link>
  );
}

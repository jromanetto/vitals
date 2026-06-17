"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import type { ScoreBreakdown } from "@/lib/scoring/longevity";

export function ScoreCompleteness({ completeness }: { completeness: ScoreBreakdown["completeness"] }) {
  const { sources, doneCount, totalCount } = completeness;
  // Headline nudge: the missing source that drives the most score.
  const nextUp = sources
    .filter((s) => !s.done)
    .sort((a, b) => b.weightPct - a.weightPct)[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-tight">Complète ton score</h2>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {doneCount}/{totalCount} sources
        </span>
      </div>

      {/* Progress dots */}
      <div className="mt-3 flex items-center gap-1.5" aria-hidden>
        {sources.map((s) => (
          <span
            key={s.key}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s.done ? "bg-emerald" : "bg-secondary"}`}
          />
        ))}
      </div>

      <div className="mt-5 space-y-2.5">
        {sources.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="flex items-center gap-3"
          >
            <span
              className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center border ${
                s.done ? "bg-emerald border-emerald text-white" : "border-border text-transparent"
              }`}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
              <div className="text-[11px] text-muted-foreground/70">
                {s.weightPct > 0 ? `${s.weightPct}% du score` : "Enrichit ton suivi"}
              </div>
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald hover:gap-1.5 transition-all"
              >
                {s.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </motion.div>
        ))}
      </div>

      {nextUp && (
        <p className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground leading-relaxed">
          {nextUp.weightPct > 0 ? (
            <>Prochaine étape : <strong className="text-foreground">{nextUp.label}</strong> compte pour {nextUp.weightPct}% du score — complète-le pour l&apos;affiner.</>
          ) : (
            <>Connecte tes <strong className="text-foreground">wearables</strong> pour enrichir ton suivi quotidien.</>
          )}
        </p>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** @deprecated use actionHref */
  ctaHref?: string;
  /** @deprecated use actionLabel */
  ctaLabel?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  ctaHref,
  ctaLabel,
}: Props) {
  const href = actionHref ?? ctaHref;
  const label = actionLabel ?? ctaLabel;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="h-14 w-14 mx-auto rounded-2xl bg-emerald/10 text-emerald flex items-center justify-center ring-1 ring-emerald/20"
      >
        <span className="[&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      </motion.div>
      <div className="space-y-1.5">
        <div className="text-base font-semibold tracking-tight">{title}</div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex mt-1 items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald text-white text-sm font-medium hover:brightness-110 transition focus-visible:ring-2 focus-visible:ring-emerald focus-visible:outline-none"
        >
          {label ?? "Démarrer →"}
        </Link>
      )}
    </motion.div>
  );
}

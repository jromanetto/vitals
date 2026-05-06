"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
  icon?: React.ReactNode;
  delay?: number;
};

export function SectionHeader({ eyebrow, title, description, cta, icon, delay = 0 }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-end justify-between gap-4 mb-5"
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium mb-2">
            {eyebrow}
          </div>
        )}
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg md:text-xl font-semibold tracking-tight">{title}</h2>
        </div>
        {description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">{description}</p>}
      </div>
      {cta && (
        <Link href={cta.href} className="text-sm text-emerald hover:underline shrink-0 inline-flex items-center gap-1 mb-1">
          {cta.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </motion.header>
  );
}

/**
 * Container that staggers its direct children using framer-motion.
 * Use with motion.div children or already-animated components.
 */
export function StaggerSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

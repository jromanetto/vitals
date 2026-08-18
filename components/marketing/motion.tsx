"use client";
/**
 * Reusable Framer Motion primitives for the marketing surface. Client islands
 * so the pages stay server-rendered around them. Every primitive honours
 * prefers-reduced-motion (renders content in its final state, no animation).
 */
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import * as React from "react";

const EASE = [0.2, 0.7, 0.2, 1] as const;

/** Fade + translate into view on scroll. Optional x for slide-ins. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  x = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  x?: number;
  className?: string;
  as?: keyof typeof motion;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as React.ComponentType<HTMLMotionProps<"div">>;
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/** Parent that staggers its <Item> children into view. */
export function Stagger({
  children,
  className,
  gap = 0.08,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className, y = 14 }: { children: React.ReactNode; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Reveal + spring lift on hover. Used for data widgets and pricing cards. */
export function HoverCard({
  children,
  className,
  lift = -5,
  reveal = true,
}: {
  children: React.ReactNode;
  className?: string;
  lift?: number;
  reveal?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce || !reveal ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      whileHover={reduce ? undefined : { y: lift }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}

/** Scale/press feedback wrapper for CTAs (works around a next/link child). */
export function Press({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}

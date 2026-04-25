"use client";
import { motion } from "framer-motion";

export function HomeHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 bg-card"
    >
      <div className="absolute inset-0 gradient-emerald pointer-events-none" />
      <div className="relative">
        <div className="text-xs uppercase tracking-widest text-emerald mb-2">Health intelligence</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
          Toute ta santé, comprise et corrélée.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl text-sm md:text-base">
          Biomarqueurs, ADN, consultations, rapports — agrégés, indexés et expliqués.
        </p>
      </div>
    </motion.div>
  );
}

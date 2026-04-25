"use client";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";

export function RecentReports() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium tracking-tight">Rapports récents</h2>
        <a href="/reports" className="text-xs text-muted-foreground hover:text-foreground">Voir tout →</a>
      </div>
      <div className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
        <FileText className="h-4 w-4" />
        Aucun rapport généré pour l'instant. Lance l'ingestion via le bouton dans Profile pour démarrer.
      </div>
    </motion.section>
  );
}

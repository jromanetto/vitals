"use client";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Activity, Dna, GitMerge, User, Pill, HeartPulse, Brain, Globe, FileText, Sparkles, Loader2, Check } from "lucide-react";

type ToolCall = { name: string; input: unknown };

const TOOL_META: Record<string, { label: string; verb: string; icon: React.ComponentType<{ className?: string }> }> = {
  search_kb:               { label: "Knowledge base",  verb: "Recherche dans tes documents",            icon: BookOpen },
  search_documents:        { label: "Documents",       verb: "Lecture des documents médicaux",          icon: FileText },
  get_biomarker_history:   { label: "Biomarqueurs",    verb: "Lecture de l'historique des biomarqueurs",icon: Activity },
  list_biomarkers:         { label: "Biomarqueurs",    verb: "Inventaire des biomarqueurs",             icon: Activity },
  get_correlation:         { label: "Corrélations",    verb: "Calcul des corrélations entre métriques", icon: GitMerge },
  get_dna:                 { label: "ADN",             verb: "Lecture de tes variants génétiques",      icon: Dna },
  search_dna:              { label: "ADN",             verb: "Recherche dans tes SNPs",                 icon: Dna },
  get_dna_insights:        { label: "ADN",             verb: "Analyse des insights ADN",                icon: Dna },
  get_profile:             { label: "Profil",          verb: "Lecture de ton profil santé",             icon: User },
  list_supplements:        { label: "Suppléments",     verb: "Lecture de ta stack actuelle",            icon: Pill },
  get_supplement_coverage: { label: "Suppléments",     verb: "Bilan nutritionnel",                      icon: Pill },
  get_symptoms:            { label: "Symptômes",       verb: "Lecture du journal de symptômes",         icon: HeartPulse },
  get_wearables:           { label: "Wearables",       verb: "Lecture des données Whoop/Oura",          icon: Activity },
  save_memory:             { label: "Mémoire",         verb: "Mémorisation pour les prochaines convs",  icon: Brain },
  recall_memory:           { label: "Mémoire",         verb: "Rappel des conversations précédentes",    icon: Brain },
  search_web:              { label: "Web",             verb: "Recherche sur internet",                  icon: Globe },
  fetch_url:               { label: "Web",             verb: "Lecture d'une page web",                  icon: Globe },
};

function metaFor(name: string) {
  return TOOL_META[name] ?? { label: name, verb: `Outil ${name}`, icon: Sparkles };
}

export function ChatThinking({ toolCalls, hasContent }: { toolCalls: ToolCall[]; hasContent: boolean }) {
  // Empty state — just thinking before any tool fires
  if (toolCalls.length === 0 && !hasContent) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
        </span>
        <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }}>
          Réflexion en cours…
        </motion.span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 mb-2">
      <AnimatePresence initial={false}>
        {toolCalls.map((tc, i) => {
          const meta = metaFor(tc.name);
          const Icon = meta.icon;
          const isLast = i === toolCalls.length - 1;
          const isActive = !hasContent && isLast;
          return (
            <motion.div
              key={`${i}-${tc.name}`}
              initial={{ opacity: 0, x: -6, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md border ${isActive ? "bg-emerald/8 border-emerald/30" : "bg-secondary/40 border-border"}`}
            >
              <Icon className={`h-3 w-3 shrink-0 ${isActive ? "text-emerald" : "text-muted-foreground"}`} />
              <span className={`truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{meta.verb}</span>
              <span className="ml-auto shrink-0">
                {isActive ? (
                  <Loader2 className="h-3 w-3 text-emerald animate-spin" />
                ) : (
                  <Check className="h-3 w-3 text-emerald/70" />
                )}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!hasContent && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
        >
          <motion.div
            className="flex gap-1"
            initial="initial" animate="animate"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-emerald/70"
                animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
          <span>Synthèse en cours…</span>
        </motion.div>
      )}
    </div>
  );
}

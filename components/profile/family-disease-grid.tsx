"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  DISEASE_CATALOG,
  CATEGORY_LABELS_FR,
  CATEGORY_ORDER,
  diseasesByCategory,
} from "@/lib/medical/disease-catalog";
import { RELATIVES } from "@/lib/medical/relatives";
import type {
  DiseaseEntry,
  FamilyDiseaseEntry,
  FamilyHistory,
  RelativeKey,
  YesNoUnknown,
} from "@/lib/medical/types";

type Props = {
  value: FamilyHistory | undefined;
  onChange: (v: FamilyHistory) => void;
};

const STATUS_OPTIONS: { v: YesNoUnknown; label: string; tone: string }[] = [
  { v: "no", label: "Non", tone: "bg-secondary/40 text-muted-foreground border-border" },
  { v: "yes", label: "Oui", tone: "bg-emerald/15 text-emerald border-emerald/40" },
  { v: "unknown", label: "?", tone: "bg-amber-500/10 text-amber-500 border-amber-500/40" },
];

function key(rel: RelativeKey, dis: string): string {
  return `${rel}.${dis}`;
}

export function FamilyDiseaseGrid({ value, onChange }: Props) {
  const fh: FamilyHistory = value ?? {};
  const grouped = diseasesByCategory();
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ cardio: true, metabolic: true });
  const [activeRel, setActiveRel] = useState<RelativeKey>("father");

  function setEntry(rel: RelativeKey, disease: DiseaseEntry, patch: Partial<FamilyDiseaseEntry>) {
    const k = key(rel, disease.id);
    const cur = fh[k] ?? { status: "unknown" as YesNoUnknown };
    const next: FamilyHistory = { ...fh, [k]: { ...cur, ...patch } };
    onChange(next);
  }

  function setStatus(rel: RelativeKey, disease: DiseaseEntry, status: YesNoUnknown) {
    setEntry(rel, disease, { status });
  }

  function totalsForRelative(rel: RelativeKey): { yes: number; total: number } {
    let yes = 0;
    for (const d of DISEASE_CATALOG) {
      const e = fh[key(rel, d.id)];
      if (e?.status === "yes") yes++;
    }
    return { yes, total: DISEASE_CATALOG.length };
  }

  return (
    <div className="space-y-4">
      {/* Relative selector tabs */}
      <div className="flex flex-wrap gap-2">
        {RELATIVES.map((r) => {
          const t = totalsForRelative(r.key);
          const active = activeRel === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveRel(r.key)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary font-medium"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
              {t.yes > 0 && (
                <span className="ml-1.5 text-[10px] text-emerald font-medium">{t.yes}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Pour chaque maladie : Non / Oui / ? (tu ne sais pas). Clique sur une catégorie pour la
        déplier. Plus c&apos;est rempli, mieux les risques héréditaires sont pondérés.
      </p>

      {/* Categories */}
      <div className="space-y-2">
        {CATEGORY_ORDER.map((cat) => {
          const diseases = grouped[cat];
          const isOpen = !!openCats[cat];
          const filledCount = diseases.filter(
            (d) => fh[key(activeRel, d.id)]?.status === "yes",
          ).length;
          return (
            <div key={cat} className="rounded-lg border border-border bg-secondary/20">
              <button
                type="button"
                onClick={() => setOpenCats({ ...openCats, [cat]: !isOpen })}
                className="w-full flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {CATEGORY_LABELS_FR[cat]}
                  {filledCount > 0 && (
                    <span className="ml-2 text-xs text-emerald">{filledCount}</span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5">
                      {diseases.map((d) => {
                        const k = key(activeRel, d.id);
                        const entry = fh[k];
                        const status = entry?.status;
                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-2 py-1"
                          >
                            <span className="text-sm flex-1 truncate" title={d.label}>
                              {d.label}
                            </span>
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((o) => {
                                const active = status === o.v;
                                return (
                                  <button
                                    key={o.v}
                                    type="button"
                                    onClick={() => setStatus(activeRel, d, o.v)}
                                    className={`min-w-[2.5rem] h-7 px-2 rounded-md text-xs border transition ${
                                      active ? o.tone : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                                    }`}
                                  >
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                            {status === "yes" && (
                              <input
                                type="number"
                                placeholder="âge"
                                value={entry?.ageOfDiagnosis ?? ""}
                                onChange={(e) =>
                                  setEntry(activeRel, d, {
                                    ageOfDiagnosis: e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                                className="w-16 h-7 bg-secondary/40 border border-border rounded-md px-2 text-xs outline-none focus:border-primary"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

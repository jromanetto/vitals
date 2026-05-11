"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Heart } from "lucide-react";
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

type PersonInfo = {
  name?: string;
  alive?: "alive" | "deceased" | "unknown";
  ageOrDeath?: string;
  causeOfDeath?: string;
  notes?: string;
};

// `pedigree` keeps the legacy shape from pedigree-editor.tsx: an object keyed by
// RelativeKey, plus siblings/children arrays. We only touch the singular keys
// here — siblings/children stay alongside if they existed before.
type Pedigree = Partial<Record<RelativeKey, PersonInfo>> & {
  siblings?: PersonInfo[];
  children?: PersonInfo[];
};

type Props = {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
};

const STATUS_OPTIONS: { v: YesNoUnknown; label: string; tone: string }[] = [
  { v: "no", label: "Non", tone: "bg-secondary/40 text-muted-foreground border-border" },
  { v: "yes", label: "Oui", tone: "bg-emerald/15 text-emerald border-emerald/40" },
  { v: "unknown", label: "?", tone: "bg-amber-500/10 text-amber-500 border-amber-500/40" },
];

const ALIVE_OPTIONS: { v: "alive" | "deceased" | "unknown"; label: string }[] = [
  { v: "alive", label: "En vie" },
  { v: "deceased", label: "Décédé·e" },
  { v: "unknown", label: "Inconnu" },
];

function key(rel: RelativeKey, dis: string): string {
  return `${rel}.${dis}`;
}

export function FamilyDiseaseGrid({ data, onChange }: Props) {
  const fh: FamilyHistory = (data.familyHistory as FamilyHistory) ?? {};
  const pedigree: Pedigree = (data.pedigree as Pedigree) ?? {};

  const grouped = diseasesByCategory();
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ cardio: true, metabolic: true });
  const [activeRel, setActiveRel] = useState<RelativeKey>("father");

  // === FamilyHistory mutations ===
  function setEntry(rel: RelativeKey, disease: DiseaseEntry, patch: Partial<FamilyDiseaseEntry>) {
    const k = key(rel, disease.id);
    const cur = fh[k] ?? { status: "unknown" as YesNoUnknown };
    onChange("familyHistory", { ...fh, [k]: { ...cur, ...patch } });
  }
  function setStatus(rel: RelativeKey, disease: DiseaseEntry, status: YesNoUnknown) {
    setEntry(rel, disease, { status });
  }

  // === Pedigree person-info mutations ===
  function setPerson(rel: RelativeKey, patch: Partial<PersonInfo>) {
    const cur = pedigree[rel] ?? {};
    onChange("pedigree", { ...pedigree, [rel]: { ...cur, ...patch } });
  }

  function totalsForRelative(rel: RelativeKey): { yes: number } {
    let yes = 0;
    for (const d of DISEASE_CATALOG) {
      const e = fh[key(rel, d.id)];
      if (e?.status === "yes") yes++;
    }
    return { yes };
  }

  const person = pedigree[activeRel] ?? {};
  const isDeceased = person.alive === "deceased";

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

      {/* Person info card for the active relative */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
          <Heart className="h-3.5 w-3.5 text-emerald" />
          {RELATIVES.find((r) => r.key === activeRel)?.label}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
              Prénom (optionnel)
            </label>
            <input
              type="text"
              value={person.name ?? ""}
              onChange={(e) => setPerson(activeRel, { name: e.target.value })}
              placeholder="—"
              className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
              Statut
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALIVE_OPTIONS.map((o) => {
                const active = person.alive === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setPerson(activeRel, { alive: o.v })}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      active
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
              {isDeceased ? "Âge au décès" : "Âge actuel"}
            </label>
            <input
              type="number"
              value={person.ageOrDeath ?? ""}
              onChange={(e) => setPerson(activeRel, { ageOrDeath: e.target.value })}
              placeholder="—"
              className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          {isDeceased && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Cause du décès
              </label>
              <input
                type="text"
                value={person.causeOfDeath ?? ""}
                onChange={(e) => setPerson(activeRel, { causeOfDeath: e.target.value })}
                placeholder="—"
                className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Pour chaque maladie : <strong>Non</strong> / <strong>Oui</strong> / <strong>?</strong> (inconnu). Clique sur
        une catégorie pour la déplier. Plus c&apos;est rempli, mieux les risques héréditaires sont pondérés.
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

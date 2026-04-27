"use client";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

// High-impact fields with their target section anchors and friendly labels.
const HIGH_IMPACT: { id: string; label: string; section: string }[] = [
  { id: "familyDiseases", label: "Maladies familiales", section: "family" },
  { id: "allergies", label: "Allergies", section: "medical" },
  { id: "medications", label: "Médicaments actuels", section: "medical" },
  { id: "currentLocation", label: "Lieu de résidence", section: "environment" },
  { id: "dietType", label: "Type d'alimentation", section: "diet" },
  { id: "activityLevel", label: "Niveau d'activité", section: "lifestyle" },
  { id: "birthDate", label: "Date de naissance", section: "identity" },
  { id: "sex", label: "Sexe biologique", section: "identity" },
  { id: "chronicConditions", label: "Maladies chroniques", section: "medical" },
  { id: "primaryGoals", label: "Objectifs santé", section: "goals" },
];

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.values(o).some((x) => x !== undefined && x !== null && x !== "");
  }
  return true;
}

export function CompletionProgress({
  data,
  totalPct,
}: {
  data: Record<string, unknown>;
  totalPct: number;
}) {
  const missing = HIGH_IMPACT.filter((f) => !isFilled(data[f.id])).slice(0, 3);

  let message: string;
  if (totalPct < 30) {
    message = `Tu es à ${totalPct}% — chaque section débloque une pièce du puzzle santé.`;
  } else if (totalPct < 70) {
    message = `${totalPct}% — tu es sur la bonne voie. 5 min pour atteindre 80%.`;
  } else {
    message = `${totalPct}% — excellent. L'IA aura un contexte ultra-précis.`;
  }

  const barColor =
    totalPct >= 70 ? "bg-emerald" : totalPct >= 30 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-emerald" />
        <h3 className="text-sm font-medium tracking-tight">Profil santé</h3>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{totalPct}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-secondary/60 border border-border overflow-hidden">
        <motion.div
          className={`h-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${totalPct}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{message}</p>

      {missing.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            À remplir en priorité
          </p>
          <ul className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <li key={m.id}>
                <a
                  href={`#${m.section}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-emerald/30 bg-emerald/10 text-emerald hover:bg-emerald/20 transition"
                >
                  {m.label}
                  <ArrowRight className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

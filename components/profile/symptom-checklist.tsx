"use client";
import { AlertTriangle } from "lucide-react";
import {
  SYMPTOM_CATEGORY_LABELS_FR,
  SYMPTOM_CATEGORY_ORDER,
  symptomsByCategory,
} from "@/lib/medical/symptom-catalog";

export function SymptomChecklist({
  value,
  onChange,
}: {
  value: string[] | undefined;
  onChange: (v: string[]) => void;
}) {
  const selected = new Set(value ?? []);
  const grouped = symptomsByCategory();

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }

  const redFlagsActive = (value ?? []).some((id) => {
    for (const cat of SYMPTOM_CATEGORY_ORDER) {
      if (grouped[cat].some((s) => s.id === id && s.redFlag)) return true;
    }
    return false;
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Coche les symptômes que tu ressens en ce moment ou de manière récurrente.
      </p>
      {redFlagsActive && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-200">
            Au moins un symptôme à discuter avec un médecin a été coché.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {SYMPTOM_CATEGORY_ORDER.map((cat) => {
          const symptoms = grouped[cat];
          if (symptoms.length === 0) return null;
          return (
            <div key={cat} className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {SYMPTOM_CATEGORY_LABELS_FR[cat]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {symptoms.map((s) => {
                  const active = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition flex items-center gap-1 ${
                        active
                          ? s.redFlag
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                            : "bg-primary/15 border-primary/40 text-primary"
                          : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.label}
                      {s.redFlag && active && <AlertTriangle className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Syringe } from "lucide-react";
import {
  VACCINES,
  VACCINE_BY_ID,
  vaccineStatus,
  nextBoosterDate,
  type VaccineStatus,
} from "@/lib/vaccines-fr";

export type VaccinationEntry = {
  id: string;
  lastDate?: string;
  notes?: string;
  custom?: boolean;
  name?: string;
};

const STATUS_STYLE: Record<VaccineStatus, { label: string; cls: string }> = {
  ok: { label: "À jour", cls: "bg-emerald/15 text-emerald border-emerald/30" },
  soon: { label: "Rappel imminent", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  due: { label: "Rappel dû", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  unknown: { label: "Non renseigné", cls: "bg-secondary/40 text-muted-foreground border-border" },
};

export function VaccinationsList({
  value,
  onChange,
  legacyText,
}: {
  value: VaccinationEntry[];
  onChange: (next: VaccinationEntry[]) => void;
  legacyText?: string;
}) {
  const byId = useMemo(() => {
    const m = new Map<string, VaccinationEntry>();
    for (const v of value) m.set(v.id, v);
    return m;
  }, [value]);

  const [customName, setCustomName] = useState("");

  function toggle(id: string, received: boolean) {
    if (received) {
      const next = value.find((v) => v.id === id) ? value : [...value, { id }];
      onChange(next);
    } else {
      onChange(value.filter((v) => v.id !== id));
    }
  }
  function patch(id: string, p: Partial<VaccinationEntry>) {
    onChange(value.map((v) => (v.id === id ? { ...v, ...p } : v)));
  }
  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    onChange([...value, { id, custom: true, name }]);
    setCustomName("");
  }

  const customs = value.filter((v) => v.custom);

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="flex items-center gap-2">
        <Syringe className="h-3.5 w-3.5 text-muted-foreground" />
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Vaccinations (calendrier français)
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {VACCINES.map((ref) => {
          const entry = byId.get(ref.id);
          const received = !!entry;
          const status = vaccineStatus(ref, entry?.lastDate);
          const next = nextBoosterDate(ref, entry?.lastDate);
          const st = STATUS_STYLE[status];
          return (
            <div
              key={ref.id}
              className={`rounded-md border p-3 transition ${received ? "border-border bg-secondary/20" : "border-border/60 bg-card"}`}
            >
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={received}
                  onChange={(e) => toggle(ref.id, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-secondary accent-emerald"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">{ref.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{ref.recommended}</p>
                </div>
              </label>
              {received && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Dernière injection
                    </label>
                    <input
                      type="date"
                      value={entry?.lastDate ?? ""}
                      onChange={(e) => patch(ref.id, { lastDate: e.target.value })}
                      className="w-full bg-secondary/40 border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Prochain rappel
                    </label>
                    <div className="text-xs px-2 py-1 rounded-md bg-secondary/20 border border-border/60 text-muted-foreground">
                      {next ?? (ref.boosterYears ? "—" : "Aucun rappel")}
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <input
                      type="text"
                      placeholder="Notes (lot, lieu, effets…)"
                      value={entry?.notes ?? ""}
                      onChange={(e) => patch(ref.id, { notes: e.target.value })}
                      className="w-full bg-secondary/40 border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {customs.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Vaccinations personnalisées
          </div>
          {customs.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <input
                  type="text"
                  value={entry.name ?? ""}
                  onChange={(e) =>
                    onChange(
                      value.map((v) =>
                        v.id === entry.id ? { ...v, name: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Nom du vaccin"
                  className="flex-1 bg-card border border-border rounded-md px-2 py-1 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v.id !== entry.id))}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="date"
                  value={entry.lastDate ?? ""}
                  onChange={(e) =>
                    onChange(
                      value.map((v) =>
                        v.id === entry.id ? { ...v, lastDate: e.target.value } : v,
                      ),
                    )
                  }
                  className="w-full bg-secondary/40 border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <input
                  type="text"
                  placeholder="Notes"
                  value={entry.notes ?? ""}
                  onChange={(e) =>
                    onChange(
                      value.map((v) =>
                        v.id === entry.id ? { ...v, notes: e.target.value } : v,
                      ),
                    )
                  }
                  className="w-full bg-secondary/40 border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Ajouter vaccination personnalisée…"
          className="flex-1 bg-secondary/40 border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={addCustom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 border border-border text-xs hover:bg-secondary transition"
        >
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      </div>

      {legacyText && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Notes vaccinales libres (legacy)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-secondary/20 p-2 text-[11px]">
            {legacyText}
          </pre>
        </details>
      )}
    </div>
  );
}

// Helper utilisé hors composant si besoin.
export function vaccineLabel(id: string, fallback?: string): string {
  return VACCINE_BY_ID[id]?.name ?? fallback ?? id;
}

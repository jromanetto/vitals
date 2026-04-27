"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Stethoscope, Search } from "lucide-react";
import { SPECIALTIES } from "@/lib/specialties-fr";

export type SpecialistEntry = {
  type: string;
  name?: string;
  city?: string;
  phone?: string;
  email?: string;
  lastVisit?: string;
  notes?: string;
};

export function SpecialistsList({
  value,
  onChange,
  legacyText,
}: {
  value: SpecialistEntry[];
  onChange: (next: SpecialistEntry[]) => void;
  legacyText?: string;
}) {
  function patch(idx: number, p: Partial<SpecialistEntry>) {
    onChange(value.map((v, i) => (i === idx ? { ...v, ...p } : v)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...value, { type: "" }]);
  }

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Spécialistes consultés
        </label>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucun spécialiste enregistré. Ajoute-en un ci-dessous.
        </p>
      )}

      <div className="space-y-2">
        {value.map((entry, idx) => (
          <SpecialistRow
            key={idx}
            entry={entry}
            onPatch={(p) => patch(idx, p)}
            onRemove={() => remove(idx)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 border border-border text-xs hover:bg-secondary transition"
      >
        <Plus className="h-3 w-3" /> Ajouter un spécialiste
      </button>

      {legacyText && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Notes spécialistes libres (legacy)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-secondary/20 p-2 text-[11px]">
            {legacyText}
          </pre>
        </details>
      )}
    </div>
  );
}

function SpecialistRow({
  entry,
  onPatch,
  onRemove,
}: {
  entry: SpecialistEntry;
  onPatch: (p: Partial<SpecialistEntry>) => void;
  onRemove: () => void;
}) {
  const [typeQuery, setTypeQuery] = useState(entry.type ?? "");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    if (!q) return SPECIALTIES.slice(0, 12);
    return SPECIALTIES.filter((s) => s.toLowerCase().includes(q)).slice(0, 12);
  }, [typeQuery]);

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1 focus-within:border-primary transition">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={typeQuery}
              onChange={(e) => {
                setTypeQuery(e.target.value);
                onPatch({ type: e.target.value });
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Type (cardiologue, kiné…)"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {open && filtered.length > 0 && (
            <div className="absolute z-20 mt-1 left-0 right-0 max-h-56 overflow-auto rounded-md border border-border bg-card shadow-lg">
              {filtered.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTypeQuery(s);
                    onPatch({ type: s });
                    setOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-sm hover:bg-secondary/60 transition text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition"
          aria-label="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Nom du praticien"
          value={entry.name ?? ""}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <input
          type="text"
          placeholder="Ville"
          value={entry.city ?? ""}
          onChange={(e) => onPatch({ city: e.target.value })}
          className="bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <input
          type="tel"
          placeholder="Téléphone"
          value={entry.phone ?? ""}
          onChange={(e) => onPatch({ phone: e.target.value })}
          className="bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <input
          type="email"
          placeholder="Email"
          value={entry.email ?? ""}
          onChange={(e) => onPatch({ email: e.target.value })}
          className="bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Dernière consultation
          </label>
          <input
            type="date"
            value={entry.lastVisit ?? ""}
            onChange={(e) => onPatch({ lastVisit: e.target.value })}
            className="w-full bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
        <input
          type="text"
          placeholder="Notes"
          value={entry.notes ?? ""}
          onChange={(e) => onPatch({ notes: e.target.value })}
          className="bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary self-end"
        />
      </div>
    </div>
  );
}

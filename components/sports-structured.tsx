"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Search, Dumbbell } from "lucide-react";
import { SPORTS, SPORT_BY_ID, SESSION_HOURS, type SportRef } from "@/lib/sports-fr";

export type SportEntry = {
  id: string;
  name?: string;
  sessions: number;
  intensity: "low" | "moderate" | "high";
  years?: number;
  notes?: string;
};

const INTENSITY_OPTS: { value: SportEntry["intensity"]; label: string }[] = [
  { value: "low", label: "Léger" },
  { value: "moderate", label: "Modéré" },
  { value: "high", label: "Intense" },
];

export function SportsStructured({
  value,
  onChange,
  legacyList,
}: {
  value: SportEntry[];
  onChange: (next: SportEntry[]) => void;
  legacyList?: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const usedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPORTS.filter((s) => !usedIds.has(s.id))
      .filter((s) =>
        q === ""
          ? true
          : s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, usedIds]);

  function addSport(ref: SportRef) {
    onChange([
      ...value,
      { id: ref.id, name: ref.name, sessions: 3, intensity: "moderate" },
    ]);
    setQuery("");
    setOpen(false);
  }

  function patch(id: string, p: Partial<SportEntry>) {
    onChange(value.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  function remove(id: string) {
    onChange(value.filter((s) => s.id !== id));
  }

  const totalHours = useMemo(
    () =>
      value.reduce(
        (acc, s) => acc + (s.sessions || 0) * SESSION_HOURS[s.intensity],
        0,
      ),
    [value],
  );

  const totalSessions = useMemo(
    () => value.reduce((a, s) => a + (s.sessions || 0), 0),
    [value],
  );

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Sports pratiqués
        </label>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((entry) => {
            const ref = SPORT_BY_ID[entry.id];
            return (
              <div
                key={entry.id}
                className="rounded-md border border-border bg-secondary/20 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {ref?.name ?? entry.name ?? entry.id}
                    </div>
                    {ref?.category && (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        {ref.category}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Séances/sem
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={entry.sessions}
                      onChange={(e) =>
                        patch(entry.id, { sessions: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Intensité
                    </label>
                    <select
                      value={entry.intensity}
                      onChange={(e) =>
                        patch(entry.id, {
                          intensity: e.target.value as SportEntry["intensity"],
                        })
                      }
                      className="w-full bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      {INTENSITY_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Années
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={entry.years ?? ""}
                      onChange={(e) =>
                        patch(entry.id, {
                          years: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      className="w-full bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      ~ Heures/sem
                    </label>
                    <div className="px-2 py-1 rounded-md bg-secondary/40 border border-border/60 text-xs text-muted-foreground tabular-nums">
                      {(entry.sessions * SESSION_HOURS[entry.intensity]).toFixed(1)} h
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Notes (objectifs, club, blessures…)"
                  value={entry.notes ?? ""}
                  onChange={(e) => patch(entry.id, { notes: e.target.value })}
                  className="w-full bg-card border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 bg-secondary/40 border border-border rounded-md px-3 py-1.5 focus-within:border-primary transition">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Rechercher un sport (course, yoga, padel…)"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {open && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 left-0 right-0 max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addSport(s);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-secondary/60 transition text-left"
              >
                <span>{s.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.category}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 rounded-md bg-secondary/40 border border-border">
            {totalSessions} séance{totalSessions > 1 ? "s" : ""}/sem
          </span>
          <span className="px-2 py-0.5 rounded-md bg-secondary/40 border border-border">
            ~ {totalHours.toFixed(1)} h/sem
          </span>
        </div>
      )}

      {legacyList && legacyList.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Sports legacy (chips)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {legacyList.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const known = SPORTS.find(
                    (x) => x.name.toLowerCase() === s.toLowerCase(),
                  );
                  if (known && !usedIds.has(known.id)) addSport(known);
                  else if (!known) {
                    onChange([
                      ...value,
                      {
                        id: `legacy_${s}`,
                        name: s,
                        sessions: 3,
                        intensity: "moderate",
                      },
                    ]);
                  }
                }}
                className="px-2 py-0.5 rounded-full text-[11px] border border-border bg-secondary/40 hover:border-primary hover:text-primary transition"
                title="Migrer vers la liste structurée"
              >
                + {s}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import {
  MEDICATIONS_FR, ALLERGIES_FR, SUPPLEMENTS_FR,
  type Medication, type Allergy, type Supplement,
} from "@/lib/medical-db";

type Kind = "medication" | "allergy" | "supplement";

type Suggestion = { value: string; label: string; meta?: string };

function suggestionsFor(kind: Kind): Suggestion[] {
  if (kind === "medication") {
    return MEDICATIONS_FR.map((m: Medication) => ({
      value: m.dci,
      label: m.brand?.length ? `${m.dci} (${m.brand.join(", ")})` : m.dci,
      meta: m.class,
    }));
  }
  if (kind === "allergy") {
    return ALLERGIES_FR.map((a: Allergy) => ({
      value: a.name,
      label: a.name,
      meta: a.category,
    }));
  }
  return SUPPLEMENTS_FR.map((s: Supplement) => ({
    value: s.name,
    label: s.name,
    meta: s.commonDose ? `${s.category} — ${s.commonDose}` : s.category,
  }));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Single combobox: search + select from list, with custom entry allowed.
 */
export function MedicalCombobox({
  kind, value, onChange, placeholder,
}: {
  kind: Kind;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const all = useMemo(() => suggestionsFor(kind), [kind]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return all.slice(0, 60);
    return all.filter((s) => normalize(s.label).includes(q) || (s.meta && normalize(s.meta).includes(q))).slice(0, 60);
  }, [all, query]);

  function commit(v: string) {
    onChange(v);
    setQuery(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 pr-8 text-sm outline-none focus:border-primary transition"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg scrollbar-thin">
          {filtered.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => commit(s.value)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/60 flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.label}</span>
              {s.meta && <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{s.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Medication list ===================== */

export type MedRow = { name: string; dose?: string; frequency?: string; since?: string; reason?: string };

export function MedicationList({
  value, onChange,
}: {
  value: MedRow[];
  onChange: (rows: MedRow[]) => void;
}) {
  const rows = Array.isArray(value) ? value : [];
  function update(i: number, patch: Partial<MedRow>) {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  }
  function add() { onChange([...rows, { name: "" }]); }
  function remove(i: number) { onChange(rows.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="rounded-md border border-border bg-secondary/20 p-2.5 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <MedicalCombobox
              kind="medication"
              value={row.name}
              onChange={(v) => update(i, { name: v })}
              placeholder="Médicament (DCI ou marque)"
            />
            <input
              type="text"
              value={row.dose ?? ""}
              onChange={(e) => update(i, { dose: e.target.value })}
              placeholder="Dose (ex: 500 mg)"
              className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
            />
            <input
              type="text"
              value={row.frequency ?? ""}
              onChange={(e) => update(i, { frequency: e.target.value })}
              placeholder="Fréquence (ex: 1x/j)"
              className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-2 rounded-md border border-border bg-secondary/30 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-400 transition text-xs flex items-center justify-center"
              aria-label="Supprimer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={row.since ?? ""}
              onChange={(e) => update(i, { since: e.target.value })}
              placeholder="Depuis (ex: 2022 ou 3 mois)"
              className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
            />
            <input
              type="text"
              value={row.reason ?? ""}
              onChange={(e) => update(i, { reason: e.target.value })}
              placeholder="Indication / raison"
              className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full px-3 py-2 rounded-md border border-dashed border-border bg-secondary/20 hover:bg-secondary/40 text-sm text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter un médicament
      </button>
    </div>
  );
}

/* ===================== Allergy list ===================== */

export type AllergyRow = { name: string; category?: string; severity?: string; notes?: string };

const SEVERITIES = ["", "Légère", "Modérée", "Sévère", "Anaphylaxie"];

export function AllergyList({
  value, onChange,
}: {
  value: AllergyRow[];
  onChange: (rows: AllergyRow[]) => void;
}) {
  const rows = Array.isArray(value) ? value : [];
  function update(i: number, patch: Partial<AllergyRow>) {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  }
  function add() { onChange([...rows, { name: "" }]); }
  function remove(i: number) { onChange(rows.filter((_, idx) => idx !== i)); }

  function autoCategory(name: string): string | undefined {
    const found = ALLERGIES_FR.find((a) => normalize(a.name) === normalize(name));
    return found?.category;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="rounded-md border border-border bg-secondary/20 p-2.5 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <MedicalCombobox
              kind="allergy"
              value={row.name}
              onChange={(v) => update(i, { name: v, category: row.category || autoCategory(v) })}
              placeholder="Allergène"
            />
            <input
              type="text"
              value={row.category ?? ""}
              onChange={(e) => update(i, { category: e.target.value })}
              placeholder="Catégorie"
              className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
            />
            <select
              value={row.severity ?? ""}
              onChange={(e) => update(i, { severity: e.target.value })}
              className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
            >
              {SEVERITIES.map((s) => <option key={s} value={s}>{s || "Sévérité"}</option>)}
            </select>
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-2 rounded-md border border-border bg-secondary/30 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-400 transition text-xs flex items-center justify-center"
              aria-label="Supprimer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={row.notes ?? ""}
            onChange={(e) => update(i, { notes: e.target.value })}
            placeholder="Notes (réaction, traitement, etc.)"
            className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full px-3 py-2 rounded-md border border-dashed border-border bg-secondary/20 hover:bg-secondary/40 text-sm text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter une allergie
      </button>
    </div>
  );
}

/* ===================== Legacy migration helpers ===================== */

/** Detect if a value is the new structured shape (array of objects) */
export function isStructured<T extends object>(v: unknown): v is T[] {
  return Array.isArray(v) && (v.length === 0 || (typeof v[0] === "object" && v[0] !== null));
}

/** Convert a legacy free-text string to a single-row structured array. */
export function migrateMedications(raw: unknown): MedRow[] {
  if (isStructured<MedRow>(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const lines = raw.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
    return lines.map((l) => ({ name: l }));
  }
  return [];
}

export function migrateAllergies(raw: unknown): AllergyRow[] {
  if (isStructured<AllergyRow>(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const lines = raw.split(/\n|;|,/).map((l) => l.trim()).filter(Boolean);
    return lines.map((l) => ({ name: l }));
  }
  return [];
}

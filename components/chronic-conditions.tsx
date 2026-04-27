"use client";
import { useState } from 'react';
import { ICD10_LABELS } from '@/lib/icd10-fr';
import { Trash2, Plus } from 'lucide-react';

export type ChronicCondition = {
  name: string;
  diagnosedDate?: string;
  status?: 'En cours' | 'Contrôlé' | 'À surveiller' | 'Résolu' | '';
  notes?: string;
};

const STATUS_OPTIONS = ['', 'En cours', 'Contrôlé', 'À surveiller', 'Résolu'];

export function ChronicConditions({ value, onChange }: { value: ChronicCondition[]; onChange: (v: ChronicCondition[]) => void }) {
  const items = value || [];
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  function update(i: number, patch: Partial<ChronicCondition>) {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function add() { onChange([...items, { name: '', status: 'En cours' }]); }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)); }

  return (
    <div className="md:col-span-2 space-y-2">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">Pathologies chroniques</label>
      <div className="space-y-2">
        {items.map((c, i) => {
          const matches = c.name && focusedIdx === i
            ? ICD10_LABELS.filter((l) => l.toLowerCase().includes(c.name.toLowerCase()) && l.toLowerCase() !== c.name.toLowerCase()).slice(0, 6)
            : [];
          return (
            <div key={i} className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_auto] gap-2">
                <div className="relative">
                  <input list={`icd10-list-${i}`} value={c.name} onChange={(e) => update(i, { name: e.target.value })}
                    onFocus={() => setFocusedIdx(i)} onBlur={() => setTimeout(() => setFocusedIdx((f) => (f === i ? null : f)), 150)}
                    placeholder="Pathologie (ex: HTA, Diabète…)"
                    className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary transition" />
                  <datalist id={`icd10-list-${i}`}>
                    {ICD10_LABELS.map((l) => <option key={l} value={l} />)}
                  </datalist>
                  {matches.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                      {matches.map((m) => (
                        <button key={m} type="button" onMouseDown={(e) => { e.preventDefault(); update(i, { name: m }); setFocusedIdx(null); }}
                          className="block w-full text-left px-3 py-1.5 text-xs hover:bg-secondary">{m}</button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="date" value={c.diagnosedDate || ''} onChange={(e) => update(i, { diagnosedDate: e.target.value })}
                  className="bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary" />
                <select value={c.status || ''} onChange={(e) => update(i, { status: e.target.value as ChronicCondition['status'] })}
                  className="bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'Statut'}</option>)}
                </select>
                <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-red-400 px-2" aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input value={c.notes || ''} onChange={(e) => update(i, { notes: e.target.value })}
                placeholder="Notes (traitement, sévérité…)"
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs outline-none focus:border-primary" />
            </div>
          );
        })}
      </div>
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Ajouter une pathologie
      </button>
    </div>
  );
}

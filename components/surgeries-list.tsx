"use client";
import { Trash2, Plus } from 'lucide-react';

export type Surgery = {
  name: string;
  date?: string;
  surgeon?: string;
  complications?: string;
};

export function SurgeriesList({ value, onChange }: { value: Surgery[]; onChange: (v: Surgery[]) => void }) {
  const items = value || [];
  function update(i: number, patch: Partial<Surgery>) {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function add() { onChange([...items, { name: '' }]); }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)); }

  return (
    <div className="md:col-span-2 space-y-2">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">Opérations chirurgicales</label>
      <div className="space-y-2">
        {items.map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_1fr_auto] gap-2">
              <input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Nom de l'opération (ex: appendicectomie)"
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary" />
              <input type="date" value={s.date || ''} onChange={(e) => update(i, { date: e.target.value })}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary" />
              <input value={s.surgeon || ''} onChange={(e) => update(i, { surgeon: e.target.value })} placeholder="Chirurgien / hôpital"
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-red-400 px-2" aria-label="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input value={s.complications || ''} onChange={(e) => update(i, { complications: e.target.value })}
              placeholder="Complications notables / séquelles"
              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs outline-none focus:border-primary" />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Ajouter une opération
      </button>
    </div>
  );
}

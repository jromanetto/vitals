"use client";

const TRIGGERS = ['Travail', 'Famille', 'Santé', 'Argent', 'Sommeil', 'Réseaux sociaux', 'Substances', 'Aucun'];

export function StressTrigger({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const selected = value || [];
  function toggle(opt: string) {
    if (opt === 'Aucun') {
      onChange(selected.includes('Aucun') ? [] : ['Aucun']);
      return;
    }
    const without = selected.filter((x) => x !== 'Aucun');
    onChange(without.includes(opt) ? without.filter((x) => x !== opt) : [...without, opt]);
  }
  return (
    <div className="md:col-span-2 space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">Triggers habituels (stress / humeur)</label>
      <div className="flex flex-wrap gap-2">
        {TRIGGERS.map((o) => {
          const active = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'}`}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

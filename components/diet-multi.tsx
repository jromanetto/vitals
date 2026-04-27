"use client";

const DIET_OPTIONS = [
  'Omnivore', 'Flexitarien', 'Pescetarien', 'Végétarien', 'Vegan', 'Carnivore',
  'Cétogène', 'Paléo', 'Méditerranéen', 'DASH', 'Whole30',
  'Sans gluten', 'Sans lactose', 'Low FODMAP',
  'Halal', 'Casher',
];

export function DietMulti({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const selected = value || [];
  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  }
  return (
    <div className="md:col-span-2 space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">Type d'alimentation (multi)</label>
      <div className="flex flex-wrap gap-2">
        {DIET_OPTIONS.map((o) => {
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

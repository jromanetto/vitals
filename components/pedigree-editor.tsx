"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Check } from "lucide-react";
import { PedigreeTree } from "./pedigree-tree";

export type Person = {
  name: string;
  alive: "alive" | "deceased" | "unknown";
  ageOrDeath: string;
  conditions: string;
  causeOfDeath?: string;
};

export type Pedigree = {
  father: Person;
  mother: Person;
  paternalGrandfather: Person;
  paternalGrandmother: Person;
  maternalGrandfather: Person;
  maternalGrandmother: Person;
  siblings: Person[];
  children: Person[];
};

const EMPTY: Person = { name: "", alive: "unknown", ageOrDeath: "", conditions: "" };

function defaults(): Pedigree {
  return {
    father: { ...EMPTY }, mother: { ...EMPTY },
    paternalGrandfather: { ...EMPTY }, paternalGrandmother: { ...EMPTY },
    maternalGrandfather: { ...EMPTY }, maternalGrandmother: { ...EMPTY },
    siblings: [], children: [],
  };
}

export function PedigreeEditor({ initial }: { initial: Record<string, unknown> }) {
  const [data, setData] = useState<Pedigree>(() => ({ ...defaults(), ...(initial as object) } as Pedigree));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [view, setView] = useState<"edit" | "tree">("edit");

  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify({ ...defaults(), ...(initial as object) })) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const cur = await (await fetch("/api/profile")).json();
      const merged = { ...(cur.data ?? {}), pedigree: data };
      await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merged) });
      setSaving(false);
      setSavedAt(new Date());
    }, 1500);
    return () => clearTimeout(t);
  }, [data, initial]);

  function setPerson(key: keyof Pedigree, p: Person) { setData({ ...data, [key]: p }); }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => setView("edit")}
                className={`text-xs px-3 py-1.5 rounded-md transition ${view === "edit" ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground hover:text-foreground"}`}>
          Édition
        </button>
        <button onClick={() => setView("tree")}
                className={`text-xs px-3 py-1.5 rounded-md transition ${view === "tree" ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground hover:text-foreground"}`}>
          Arbre
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {saving ? <><Save className="h-3 w-3 animate-pulse" /> Enregistrement…</>
                  : savedAt ? <><Check className="h-3 w-3 text-emerald" /> Enregistré</>
                            : <span>Auto-save activé</span>}
        </div>
      </div>

      {view === "edit" ? (
        <div className="space-y-5">
          <PersonGroup title="Parents" cols={2}>
            <PersonInput label="Père" value={data.father} onChange={(p) => setPerson("father", p)} />
            <PersonInput label="Mère" value={data.mother} onChange={(p) => setPerson("mother", p)} />
          </PersonGroup>
          <PersonGroup title="Grands-parents paternels" cols={2}>
            <PersonInput label="Grand-père" value={data.paternalGrandfather} onChange={(p) => setPerson("paternalGrandfather", p)} />
            <PersonInput label="Grand-mère" value={data.paternalGrandmother} onChange={(p) => setPerson("paternalGrandmother", p)} />
          </PersonGroup>
          <PersonGroup title="Grands-parents maternels" cols={2}>
            <PersonInput label="Grand-père" value={data.maternalGrandfather} onChange={(p) => setPerson("maternalGrandfather", p)} />
            <PersonInput label="Grand-mère" value={data.maternalGrandmother} onChange={(p) => setPerson("maternalGrandmother", p)} />
          </PersonGroup>
          <PersonList title="Fratrie" people={data.siblings} onChange={(arr) => setData({ ...data, siblings: arr })} />
          <PersonList title="Enfants" people={data.children} onChange={(arr) => setData({ ...data, children: arr })} />
        </div>
      ) : (
        <PedigreeTree data={data} />
      )}
    </div>
  );
}

function PersonGroup({ title, children, cols }: { title: string; children: React.ReactNode; cols: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium mb-4">{title}</h2>
      <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4`}>{children}</div>
    </motion.section>
  );
}

function PersonInput({ label, value, onChange }: { label: string; value: Person; onChange: (p: Person) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })}
             placeholder="Nom" className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
      <div className="grid grid-cols-2 gap-2">
        <select value={value.alive ?? "unknown"} onChange={(e) => onChange({ ...value, alive: e.target.value as Person["alive"] })}
                className="bg-secondary/40 border border-border rounded-md px-2 py-2 text-sm outline-none focus:border-primary">
          <option value="unknown">—</option>
          <option value="alive">Vivant</option>
          <option value="deceased">Décédé</option>
        </select>
        <input value={value.ageOrDeath ?? ""} onChange={(e) => onChange({ ...value, ageOrDeath: e.target.value })}
               placeholder={value.alive === "deceased" ? "Âge décès" : "Âge"}
               className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>
      <textarea value={value.conditions ?? ""} onChange={(e) => onChange({ ...value, conditions: e.target.value })}
                placeholder="Pathologies / antécédents" rows={2}
                className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
      {value.alive === "deceased" && (
        <input value={value.causeOfDeath ?? ""} onChange={(e) => onChange({ ...value, causeOfDeath: e.target.value })}
               placeholder="Cause du décès"
               className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
      )}
    </div>
  );
}

function PersonList({ title, people, onChange }: { title: string; people: Person[]; onChange: (p: Person[]) => void }) {
  function add() { onChange([...people, { ...EMPTY }]); }
  function update(i: number, p: Person) { const next = [...people]; next[i] = p; onChange(next); }
  function remove(i: number) { onChange(people.filter((_, idx) => idx !== i)); }
  return (
    <motion.section initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">{title} ({people.length})</h2>
        <button onClick={add} className="text-xs px-2 py-1 rounded-md bg-secondary/40 hover:bg-secondary border border-border">+ Ajouter</button>
      </div>
      {people.length === 0 && <div className="text-xs text-muted-foreground">Aucun.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {people.map((p, i) => (
          <div key={i} className="relative">
            <PersonInput label={`#${i + 1}`} value={p} onChange={(np) => update(i, np)} />
            <button onClick={() => remove(i)} className="absolute top-0 right-0 text-xs text-muted-foreground hover:text-red-400">×</button>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

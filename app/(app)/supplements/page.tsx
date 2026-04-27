"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Sparkles, Check, X, Activity, Dna } from "lucide-react";
import { AdherenceCalendar } from "@/components/adherence-calendar";
import { InteractionsCard } from "@/components/interactions-card";

type Supplement = {
  id: number; name: string; dose: string | null; unit: string | null;
  timing: string | null; frequency: string | null;
  startedAt: number | null; endedAt: number | null;
  notes: string | null; targetBiomarker: string | null; targetSnp: string | null;
};

type Suggestion = {
  source: "biomarker" | "dna";
  supplement: string; reason: string;
  biomarker?: string; biomarkerSlug?: string; value?: number; unit?: string;
  rsid?: string; trait?: string; genotype?: string;
  dose: string; timing: string;
  priority: "high" | "moderate" | "info";
};

const PRIORITY_STYLES = {
  high: "border-red-500/30 bg-red-500/5",
  moderate: "border-amber-500/30 bg-amber-500/5",
  info: "border-emerald/30 bg-emerald/5",
};
const PRIORITY_LABELS = { high: "Priorité haute", moderate: "Modéré", info: "Info" };

export default function SupplementsPage() {
  const [rows, setRows] = useState<Supplement[]>([]);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [form, setForm] = useState({ name: "", dose: "", unit: "mg", timing: "matin", frequency: "1x/jour", notes: "", targetBiomarker: "", targetSnp: "" });
  const [filter, setFilter] = useState<"all" | "biomarker" | "dna">("all");
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    const r = await fetch("/api/supplements");
    const d = await r.json();
    setRows(d.rows ?? []);
    setTaken(new Set(d.takenToday ?? []));
    const sg = await fetch("/api/supplements/suggestions");
    setSuggestions((await sg.json()).suggestions ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) return;
    await fetch("/api/supplements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing?.id }) });
    setShowForm(false); setEditing(null);
    setForm({ name: "", dose: "", unit: "mg", timing: "matin", frequency: "1x/jour", notes: "", targetBiomarker: "", targetSnp: "" });
    load();
  }
  async function del(id: number) {
    if (!confirm("Supprimer ce supplément ?")) return;
    await fetch(`/api/supplements?id=${id}`, { method: "DELETE" });
    load();
  }
  async function toggleTaken(id: number) {
    const next = new Set(taken);
    const isTaken = next.has(id);
    if (isTaken) next.delete(id); else next.add(id);
    setTaken(next);
    await fetch("/api/supplements/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplementId: id, date: today, taken: !isTaken }) });
  }
  async function addFromSuggestion(s: Suggestion) {
    const targetBiomarker = s.biomarkerSlug ?? null;
    const targetSnp = s.rsid ?? null;
    await fetch("/api/supplements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: s.supplement, dose: s.dose, timing: s.timing, frequency: "1x/jour", notes: s.reason, targetBiomarker, targetSnp }) });
    load();
  }

  const active = rows.filter((r) => r.endedAt === null);
  const ended = rows.filter((r) => r.endedAt !== null);
  const filteredSuggestions = filter === "all" ? suggestions : suggestions.filter((s) => s.source === filter);

  const bmCount = suggestions.filter((s) => s.source === "biomarker").length;
  const dnaCount = suggestions.filter((s) => s.source === "dna").length;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppléments</h1>
          <p className="text-muted-foreground mt-1 text-sm">Suivi quotidien · adhérence · suggestions personnalisées (biomarkers + ADN) · interactions.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </div>

      <InteractionsCard />

      {suggestions.length > 0 && (
        <section className="rounded-xl border border-emerald/30 bg-emerald/5 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald" />
              <h2 className="text-sm font-medium">Suggestions personnalisées ({suggestions.length})</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {(["all", "biomarker", "dna"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 rounded-full border transition ${filter === f ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {f === "all" ? `Tous (${suggestions.length})` : f === "biomarker" ? `Biomarkers (${bmCount})` : `ADN (${dnaCount})`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {filteredSuggestions.map((s, i) => (
              <motion.div key={i + s.supplement} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          className={`flex items-start justify-between gap-4 p-3 rounded-md border ${PRIORITY_STYLES[s.priority]}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {s.source === "biomarker" ? <Activity className="h-3 w-3 text-emerald shrink-0" /> : <Dna className="h-3 w-3 text-emerald shrink-0" />}
                    <span className="font-medium text-sm">{s.supplement}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto shrink-0">{PRIORITY_LABELS[s.priority]}</span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{s.reason}</div>
                  <div className="text-xs mt-2">
                    {s.dose !== "—" && <span className="text-emerald">{s.dose}</span>}
                    {s.timing !== "—" && <span className="text-muted-foreground"> · {s.timing}</span>}
                    {s.biomarker && <span className="text-muted-foreground"> · {s.biomarker}: {s.value} {s.unit}</span>}
                    {s.rsid && <span className="text-muted-foreground"> · {s.rsid} {s.genotype}</span>}
                  </div>
                </div>
                <button onClick={() => addFromSuggestion(s)} className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 self-start">+ Ajouter</button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <span>Stack actuel ({active.length})</span>
          <span className="text-xs text-muted-foreground">· {today}</span>
        </h2>
        {active.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center rounded-xl border border-border">Aucun supplément actif.</div>}
        <div className="space-y-2">
          {active.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <button onClick={() => toggleTaken(r.id)} className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${taken.has(r.id) ? "bg-emerald border-emerald" : "border-border hover:border-emerald/50"}`} aria-label={taken.has(r.id) ? "Pris aujourd'hui" : "Marquer pris"}>
                {taken.has(r.id) && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.dose && <span>{r.dose} </span>}
                  {r.timing && <span>· {r.timing} </span>}
                  {r.frequency && <span>· {r.frequency}</span>}
                  {r.targetSnp && <span> · {r.targetSnp}</span>}
                  {r.notes && <div className="mt-1">{r.notes}</div>}
                </div>
              </div>
              <button onClick={() => del(r.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400" aria-label="Supprimer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {active.length > 0 && <AdherenceCalendar supplements={active.map((r) => ({ id: r.id, name: r.name, startedAt: r.startedAt }))} />}

      {ended.length > 0 && (
        <section>
          <h2 className="text-sm font-medium mb-3 text-muted-foreground">Anciens ({ended.length})</h2>
          <div className="space-y-1">
            {ended.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-md text-sm text-muted-foreground">
                <span className="opacity-50">{r.name}</span>
                {r.dose && <span className="text-xs">{r.dose}</span>}
                <button onClick={() => del(r.id)} className="ml-auto p-1 hover:text-red-400" aria-label="Supprimer"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Nouveau supplément</h3>
                <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Nom (ex: Vitamine D3)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Dose (ex: 4000)" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input placeholder="Unité" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Timing" value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input placeholder="Fréquence" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-md text-sm">Annuler</button>
                <button onClick={save} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium">Enregistrer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

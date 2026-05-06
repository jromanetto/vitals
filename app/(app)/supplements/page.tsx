"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Sparkles, Check, X, Activity, Dna, ShieldAlert, AlertTriangle, Pill } from "lucide-react";
import { InteractionsCard } from "@/components/interactions-card";
import { SupplementCoverage } from "@/components/supplement-coverage";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";

type Supplement = {
  id: number; name: string; dose: string | null; unit: string | null;
  timing: string | null; frequency: string | null;
  startedAt: number | null; endedAt: number | null;
  notes: string | null; targetBiomarker: string | null; targetSnp: string | null;
  url: string | null; brand: string | null; imageUrl: string | null;
  ingredients: { name: string; dose?: string; unit?: string; nrv?: number; category?: string }[] | null;
  servingSize: string | null; suggestedUse: string | null; price: string | null; duration: string | null;
};

type Suggestion = {
  source: "biomarker" | "dna";
  supplement: string; reason: string;
  biomarker?: string; biomarkerSlug?: string; value?: number; unit?: string;
  rsid?: string; trait?: string; genotype?: string;
  dose: string; timing: string;
  priority: "high" | "moderate" | "info";
  coveredBy?: { id: number; name: string; nutrient: string } | null;
  kind?: "supplement" | "avoid";
  avoidNutrients?: string[];
  conflictsWith?: { id: number; name: string; nutrient: string }[];
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
  const _searchParams = useSearchParams();
  useEffect(() => {
    if (_searchParams.get("new") === "1") setShowForm(true);
  }, [_searchParams]);
  const [inputMode, setInputMode] = useState<"url" | "manual">("url");
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [form, setForm] = useState<any>({ name: "", dose: "", unit: "mg", timing: "matin", frequency: "1x/jour", notes: "", targetBiomarker: "", targetSnp: "", url: "", brand: "", imageUrl: "", ingredients: [], servingSize: "", suggestedUse: "", duration: "continu" });
  const [filter, setFilter] = useState<"all" | "biomarker" | "dna">("all");
  const [bloodHelp, setBloodHelp] = useState<{ biomarker: string; status: string; nutrient: string }[]>([]);
  const [showCovered, setShowCovered] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    const r = await fetch("/api/supplements");
    const d = await r.json();
    setRows(d.rows ?? []);
    setTaken(new Set(d.takenToday ?? []));
    const sg = await fetch("/api/supplements/suggestions");
    setSuggestions((await sg.json()).suggestions ?? []);
    // Pull last blood-panel statuses to tag nutrients that fill a gap
    try {
      const br = await fetch("/api/biomarkers/latest");
      const bd = await br.json();
      const rows = (bd.rows ?? []) as Array<{ slug: string; status: string }>;
      const help = rows
        .filter((row) => row.status === "low" || row.status === "slightly-off" || row.status === "attention")
        .map((row) => ({ biomarker: row.slug, status: row.status, nutrient: row.slug }));
      setBloodHelp(help);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name) return;
    await fetch("/api/supplements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing?.id }) });
    setShowForm(false); setEditing(null);
    setForm({ name: "", dose: "", unit: "mg", timing: "matin", frequency: "1x/jour", notes: "", targetBiomarker: "", targetSnp: "", url: "", brand: "", imageUrl: "", ingredients: [], servingSize: "", suggestedUse: "", duration: "continu" });
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
  const supplementSuggestions = suggestions.filter((s) => (s.kind ?? "supplement") === "supplement");
  const avoidSuggestions = suggestions.filter((s) => s.kind === "avoid");
  const baseFiltered = filter === "all" ? supplementSuggestions : supplementSuggestions.filter((s) => s.source === filter);
  const filteredSuggestions = showCovered ? baseFiltered : baseFiltered.filter((s) => !s.coveredBy);
  const coveredHiddenCount = baseFiltered.length - filteredSuggestions.length;
  // Aggregate conflicts: which active supplement IDs conflict with avoid SNPs
  const conflictMap: Record<number, { name: string; reasons: string[] }> = {};
  for (const av of avoidSuggestions) {
    for (const c of av.conflictsWith ?? []) {
      if (!conflictMap[c.id]) conflictMap[c.id] = { name: c.name, reasons: [] };
      conflictMap[c.id].reasons.push(`${av.trait ?? av.supplement} (${av.rsid ?? ""}): contient ${c.nutrient}`);
    }
  }

  const bmCount = supplementSuggestions.filter((s) => s.source === "biomarker").length;
  const dnaCount = supplementSuggestions.filter((s) => s.source === "dna").length;

  return (
    <div className="space-y-12">
      <PageHeader
        title="Suppléments"
        description="Suivi quotidien · adhérence · suggestions personnalisées (biomarkers + ADN) · interactions."
        icon={<Pill className="h-5 w-5 text-emerald" />}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setShowForm(true); }}>
            Ajouter
          </Button>
        }
      />

      <InteractionsCard />

      {suggestions.length > 0 && (
        <section className="rounded-xl border border-emerald/30 bg-emerald/5 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald" />
              <h2 className="text-sm font-medium">Suggestions personnalisées ({supplementSuggestions.length})</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {(["all", "biomarker", "dna"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 rounded-full border transition ${filter === f ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {f === "all" ? `Tous (${supplementSuggestions.length})` : f === "biomarker" ? `Biomarkers (${bmCount})` : `ADN (${dnaCount})`}
                </button>
              ))}
              {coveredHiddenCount > 0 && !showCovered && (
                <button onClick={() => setShowCovered(true)}
                        className="px-2.5 py-1 rounded-full border bg-card border-border text-muted-foreground hover:text-foreground transition">
                  + {coveredHiddenCount} déjà couvert{coveredHiddenCount > 1 ? "s" : ""}
                </button>
              )}
              {showCovered && (
                <button onClick={() => setShowCovered(false)}
                        className="px-2.5 py-1 rounded-full border bg-emerald/10 border-emerald/30 text-emerald hover:bg-emerald/20 transition">
                  Masquer les couverts
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {filteredSuggestions.map((s, i) => (
              <motion.div key={i + s.supplement} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                          className={`flex items-start justify-between gap-4 p-3 rounded-md border transition ${PRIORITY_STYLES[s.priority]} ${s.coveredBy ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {s.source === "biomarker" ? <Activity className="h-3 w-3 text-emerald shrink-0" /> : <Dna className="h-3 w-3 text-emerald shrink-0" />}
                    <span className="font-medium text-sm">{s.supplement}</span>
                    {s.coveredBy && (
                      <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald/15 border border-emerald/30 text-emerald shrink-0">
                        <Check className="h-2.5 w-2.5" /> Déjà couvert · {s.coveredBy.name}
                      </span>
                    )}
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
                {s.coveredBy ? (
                  <span className="text-[10px] text-muted-foreground shrink-0 self-start italic">déjà pris</span>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => addFromSuggestion(s)} className="shrink-0 self-start">+ Ajouter</Button>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {avoidSuggestions.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-medium">À éviter ({avoidSuggestions.length})</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">Variants ADN imposant des restrictions</span>
          </div>
          <div className="space-y-2">
            {avoidSuggestions.map((s, i) => (
              <motion.div key={i + s.supplement} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                          className="rounded-md border border-amber-500/30 bg-card/40 p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Dna className="h-3 w-3 text-amber-400 shrink-0" />
                      <span className="font-medium text-sm">{s.supplement}</span>
                      {s.conflictsWith && s.conflictsWith.length > 0 && (
                        <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> Conflit avec {s.conflictsWith.length} supplément{s.conflictsWith.length > 1 ? "s" : ""} actif{s.conflictsWith.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-1">{s.reason}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{s.rsid} · {s.genotype}</div>
                    {s.conflictsWith && s.conflictsWith.length > 0 && (
                      <div className="mt-2 text-[11px] text-red-400 space-y-0.5">
                        {s.conflictsWith.map((c, j) => (
                          <div key={j}>⚠ <span className="font-medium">{c.name}</span> contient {c.nutrient} — à reconsidérer</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <SupplementCoverage refreshKey={rows.length} bloodHelp={bloodHelp} />

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
                  {r.brand && <span> · {r.brand}</span>}
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-1 text-emerald hover:underline">
                    <img src={`https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(r.url).hostname; } catch { return ""; } })()}&sz=32`} alt="" className="h-3 w-3 rounded-sm" />
                    Voir produit ↗
                  </a>}
                  {conflictMap[r.id] && (
                    <div className="mt-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
                      <div className="font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Conflit ADN détecté</div>
                      {conflictMap[r.id].reasons.map((reason, j) => <div key={j} className="text-[10px] mt-0.5">{reason}</div>)}
                    </div>
                  )}
                  {r.notes && <div className="mt-1">{r.notes}</div>}
                  {r.servingSize && <div className="mt-1 text-emerald">{r.servingSize}</div>}
                  {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer hover:text-emerald transition">📋 {r.ingredients.length} ingrédients</summary>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
                        {r.ingredients.map((ing: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-border/30">
                            <span className="truncate">{ing.name}</span>
                            <span className="text-muted-foreground font-mono shrink-0">
                              {ing.dose} {ing.unit}{typeof ing.nrv === "number" && ing.nrv > 0 ? ` (${ing.nrv}%)` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => del(r.id)} className="hover:bg-red-500/10 hover:text-red-400 px-1.5" aria-label="Supprimer">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      
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
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} aria-label="Fermer" className="px-1.5"><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex gap-1 p-1 bg-secondary/30 rounded-lg border border-border">
                <button type="button" onClick={() => setInputMode("url")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${inputMode === "url" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  🌐 Depuis une URL produit
                </button>
                <button type="button" onClick={() => setInputMode("manual")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${inputMode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  ✏️ Saisie manuelle
                </button>
              </div>

              <div className="space-y-3">
                {inputMode === "url" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">URL du produit</label>
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          placeholder="https://drstanfield.com/... · iHerb · Amazon · marque"
                          value={form.url}
                          onChange={(e) => setForm({ ...form, url: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (document.getElementById("sup-import-btn") as HTMLButtonElement)?.click(); } }}
                          className="flex-1"
                        />
                        <button
                          id="sup-import-btn"
                          type="button"
                          onClick={async () => {
                            if (!form.url) return;
                            const btn = document.getElementById("sup-import-btn") as HTMLButtonElement | null;
                            const prev = btn?.textContent;
                            if (btn) { btn.disabled = true; btn.textContent = "Extraction…"; }
                            try {
                              const r = await fetch("/api/supplements/from-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: form.url }) });
                              const d = await r.json();
                              if (d.ok || d.name || d.suggestedName) {
                                setForm((f: any) => ({
                                  ...f,
                                  name: d.name || d.suggestedName || f.name || "",
                                  brand: d.brand || f.brand || "",
                                  imageUrl: d.image || f.imageUrl || "",
                                  ingredients: Array.isArray(d.ingredients) ? d.ingredients : f.ingredients,
                                  servingSize: d.servingSize || f.servingSize || "",
                                  suggestedUse: d.suggestedUse || f.suggestedUse || "",
                                }));
                              }
                            } finally { if (btn) { btn.disabled = false; btn.textContent = prev || "Importer"; } }
                          }}
                          className="px-4 py-2 rounded-md bg-emerald/15 hover:bg-emerald/25 border border-emerald/30 text-emerald text-xs font-medium transition disabled:opacity-50"
                        >
                          Importer
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Colle une URL produit, on extrait automatiquement nom, marque, image et tous les ingrédients.</p>
                    </div>

                    {(form.name || form.imageUrl) && (
                      <div className="rounded-lg border border-emerald/30 bg-emerald/5 p-3 space-y-2">
                        <div className="flex gap-3">
                          {form.imageUrl && <img src={form.imageUrl} alt="" className="h-16 w-16 rounded-md border border-border object-contain bg-secondary/30 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <input
                              value={form.name}
                              onChange={(e) => setForm({ ...form, name: e.target.value })}
                              className="w-full bg-transparent border-0 border-b border-border/40 px-0 py-0.5 text-sm font-medium outline-none focus:border-primary"
                            />
                            <input
                              value={form.brand}
                              placeholder="Marque"
                              onChange={(e) => setForm({ ...form, brand: e.target.value })}
                              className="w-full bg-transparent border-0 px-0 py-0.5 text-xs text-muted-foreground outline-none"
                            />
                          </div>
                        </div>
                        {form.servingSize && <div className="text-xs"><span className="text-emerald font-medium">Posologie:</span> <span className="text-muted-foreground">{form.servingSize}</span></div>}
                        {form.suggestedUse && <div className="text-xs text-muted-foreground italic">{form.suggestedUse}</div>}
                        {Array.isArray(form.ingredients) && form.ingredients.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-emerald hover:underline">📋 {form.ingredients.length} ingrédients détectés</summary>
                            <div className="mt-2 max-h-40 overflow-y-auto border border-border/40 rounded-md p-2 space-y-1 scrollbar-thin">
                              {form.ingredients.map((ing: any, i: number) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="truncate">{ing.name}</span>
                                  <span className="text-muted-foreground font-mono shrink-0">
                                    {ing.dose} {ing.unit}{typeof ing.nrv === "number" && ing.nrv > 0 ? ` · ${ing.nrv}% AR` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Input autoFocus placeholder="Nom (ex: Vitamine D3)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <Input placeholder="Marque (ex: Thorne, Nordic Naturals…)" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Dose (ex: 4000)" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
                  <Input placeholder="Unité" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Timing" value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} />
                  <Input placeholder="Fréquence" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
                </div>
                <Select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                  <option value="continu">Continu (à vie / quotidien)</option>
                  <option value="3 mois">Cure 3 mois</option>
                  <option value="2 mois">Cure 2 mois</option>
                  <option value="1 mois">Cure 1 mois</option>
                  <option value="6 semaines">6 semaines</option>
                  <option value="hiver">Hiver uniquement</option>
                  <option value="ponctuel">Ponctuel (au besoin)</option>
                </Select>
                <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
                <Button variant="primary" size="lg" onClick={save}>Enregistrer</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
